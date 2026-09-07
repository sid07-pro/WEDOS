import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from './wedding-scope.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { Expense } from '../../generated/prisma/client';
import { formatAmount, fromMinorUnits, toMinorUnits } from './money.util';

export interface ExpenseResponse {
  id: string;
  title: string;
  /** Decimal string with two fraction digits, e.g. "45000.00". */
  amount: string;
  category: string;
  isPaid: boolean;
}

export interface ExpenseListResponse {
  expenses: ExpenseResponse[];
  summary: {
    totalBudget: number;
    totalSpent: number;
    remainingBudget: number;
    paidAmount: number;
    unpaidAmount: number;
    spentPercentage: number;
  };
  categories: string[];
}

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private weddingScope: WeddingScopeService,
  ) {}

  async list(userId: string): Promise<ExpenseListResponse> {
    const wedding = await this.weddingScope.requireWedding(userId);
    const weddingId = wedding.id;
    const expenses = await this.prisma.expense.findMany({
      where: { weddingId },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });

    // Totals are accumulated in minor units to avoid floating-point drift.
    let spentMinor = 0;
    let paidMinor = 0;

    for (const expense of expenses) {
      const minor = toMinorUnits(expense.amount);
      spentMinor += minor;
      if (expense.isPaid) {
        paidMinor += minor;
      }
    }

    const budgetMinor = toMinorUnits(wedding.totalBudget);
    const remainingMinor = Math.max(0, budgetMinor - spentMinor);
    const spentPercentage =
      budgetMinor > 0
        ? Math.min(100, Math.round((spentMinor / budgetMinor) * 100))
        : 0;

    return {
      expenses: expenses.map((expense) => this.toResponse(expense)),
      summary: {
        totalBudget: fromMinorUnits(budgetMinor),
        totalSpent: fromMinorUnits(spentMinor),
        remainingBudget: fromMinorUnits(remainingMinor),
        paidAmount: fromMinorUnits(paidMinor),
        unpaidAmount: fromMinorUnits(spentMinor - paidMinor),
        spentPercentage,
      },
      categories: [...new Set(expenses.map((e) => e.category))].sort(),
    };
  }

  async get(userId: string, expenseId: string): Promise<ExpenseResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    return this.toResponse(await this.findOwned(weddingId, expenseId));
  }

  async create(
    userId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const expense = await this.prisma.expense.create({
      data: {
        weddingId,
        title: dto.title.trim(),
        amount: dto.amount,
        category: dto.category.trim(),
        isPaid: dto.isPaid ?? false,
      },
    });

    return this.toResponse(expense);
  }

  async update(
    userId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, expenseId);

    const expense = await this.prisma.expense.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
      },
    });

    return this.toResponse(expense);
  }

  async remove(userId: string, expenseId: string): Promise<{ id: string }> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, expenseId);

    await this.prisma.expense.delete({ where: { id: existing.id } });

    return { id: existing.id };
  }

  private async findOwned(
    weddingId: string,
    expenseId: string,
  ): Promise<Expense> {
    const id = expenseId?.trim();
    const expense = id
      ? await this.prisma.expense.findFirst({ where: { id, weddingId } })
      : null;

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  private toResponse(expense: Expense): ExpenseResponse {
    return {
      id: expense.id,
      title: expense.title,
      amount: formatAmount(expense.amount),
      category: expense.category,
      isPaid: expense.isPaid,
    };
  }
}
