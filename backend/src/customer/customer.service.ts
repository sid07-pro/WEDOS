import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeddingDto } from './dto/create-wedding.dto';
import { UpdateWeddingDto } from './dto/update-wedding.dto';
import { fromMinorUnits, toMinorUnits } from './money.util';

export interface DashboardEvent {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  dueDate: string | null;
  isCompleted: boolean;
}

export interface CustomerDashboardResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  hasWedding: boolean;
  wedding: {
    id: string;
    date: string;
    location: string;
    totalBudget: number;
    daysToGo: number;
  } | null;
  budget: {
    totalBudget: number;
    totalSpent: number;
    remainingBudget: number;
    spentPercentage: number;
  };
  events: DashboardEvent[];
  upcomingEventsCount: number;
  nextEvent: DashboardEvent | null;
  tasks: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    completedPercentage: number;
  };
  upcomingTasks: DashboardTask[];
  guests: {
    totalGuests: number;
    attending: number;
    pending: number;
    declined: number;
    totalHeadcount: number;
  };
}

export interface WeddingDetailsResponse {
  id: string;
  date: string;
  location: string;
  totalBudget: string;
}

/** How many upcoming events / tasks the dashboard renders inline. */
const DASHBOARD_LIST_LIMIT = 5;

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async getWedding(userId: string): Promise<WeddingDetailsResponse> {
    const wedding = await this.prisma.wedding.findUnique({
      where: { customerId: userId },
    });

    if (!wedding) {
      throw new NotFoundException('Wedding details were not found');
    }

    return this.toWeddingDetailsResponse(wedding);
  }

  async createWedding(
    userId: string,
    createWeddingDto: CreateWeddingDto,
  ): Promise<WeddingDetailsResponse> {
    const date = this.parseWeddingDate(createWeddingDto.date);
    const location = this.normalizeLocation(createWeddingDto.location);

    // A customer owns at most one wedding (enforced by the unique customerId).
    const existingWedding = await this.prisma.wedding.findUnique({
      where: { customerId: userId },
      select: { id: true },
    });

    if (existingWedding) {
      throw new ConflictException('A wedding already exists for this customer');
    }

    const wedding = await this.prisma.wedding.create({
      data: {
        customerId: userId,
        date,
        location,
        totalBudget: createWeddingDto.totalBudget,
      },
    });

    return this.toWeddingDetailsResponse(wedding);
  }

  async updateWedding(
    userId: string,
    updateWeddingDto: UpdateWeddingDto,
  ): Promise<WeddingDetailsResponse> {
    const date = this.parseWeddingDate(updateWeddingDto.date);
    const location = this.normalizeLocation(updateWeddingDto.location);

    const wedding = await this.prisma.wedding.findUnique({
      where: { customerId: userId },
      select: { id: true },
    });

    if (!wedding) {
      throw new NotFoundException('Wedding details were not found');
    }

    const updatedWedding = await this.prisma.wedding.update({
      where: { customerId: userId },
      data: {
        date,
        location,
        totalBudget: updateWeddingDto.totalBudget,
      },
    });

    return this.toWeddingDetailsResponse(updatedWedding);
  }

  private normalizeLocation(value: string): string {
    const location = value.trim();

    if (!location) {
      throw new BadRequestException('Wedding location is required');
    }

    return location;
  }

  private parseWeddingDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Wedding date is invalid');
    }

    return date;
  }

  private toWeddingDetailsResponse(wedding: {
    id: string;
    date: Date;
    location: string;
    totalBudget: { toString(): string };
  }): WeddingDetailsResponse {
    return {
      id: wedding.id,
      date: wedding.date.toISOString(),
      location: wedding.location,
      totalBudget: wedding.totalBudget.toString(),
    };
  }

  async getDashboard(userId: string): Promise<CustomerDashboardResponse> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wedding = await this.prisma.wedding.findUnique({
      where: { customerId: userId },
      include: {
        events: {
          where: {
            endTime: { gte: now },
          },
          orderBy: { startTime: 'asc' },
        },
        expenses: true,
        tasks: {
          orderBy: { dueDate: 'asc' },
        },
        guests: true,
      },
    });

    if (!wedding) {
      return {
        user,
        hasWedding: false,
        wedding: null,
        budget: {
          totalBudget: 0,
          totalSpent: 0,
          remainingBudget: 0,
          spentPercentage: 0,
        },
        events: [],
        upcomingEventsCount: 0,
        nextEvent: null,
        tasks: {
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          completedPercentage: 0,
        },
        upcomingTasks: [],
        guests: {
          totalGuests: 0,
          attending: 0,
          pending: 0,
          declined: 0,
          totalHeadcount: 0,
        },
      };
    }

    // Calculate days to wedding
    const weddingDate = new Date(wedding.date);
    const diffTime = weddingDate.getTime() - now.getTime();
    const daysToGo = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Budget metrics are accumulated in minor units so repeated additions of
    // decimal amounts cannot drift.
    const budgetMinor = toMinorUnits(wedding.totalBudget);
    const spentMinor = wedding.expenses.reduce(
      (sum, exp) => sum + toMinorUnits(exp.amount),
      0,
    );
    const totalBudget = fromMinorUnits(budgetMinor);
    const totalSpent = fromMinorUnits(spentMinor);
    const remainingBudget = fromMinorUnits(
      Math.max(0, budgetMinor - spentMinor),
    );
    const spentPercentage =
      budgetMinor > 0
        ? Math.min(100, Math.round((spentMinor / budgetMinor) * 100))
        : 0;

    // Events are already filtered to the upcoming ones and ordered by the query.
    const upcomingEvents: DashboardEvent[] = wedding.events.map((e) => ({
      id: e.id,
      name: e.name,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      location: e.location,
    }));

    const nextEvent = upcomingEvents[0] || null;

    // Task metrics
    const totalTasks = wedding.tasks.length;
    const completedTasks = wedding.tasks.filter((t) => t.isCompleted).length;
    const pendingTasks = totalTasks - completedTasks;
    const completedPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Tasks are ordered by due date (undated ones last) by the query.
    const upcomingTasks: DashboardTask[] = wedding.tasks
      .filter((t) => !t.isCompleted)
      .slice(0, DASHBOARD_LIST_LIMIT)
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        isCompleted: t.isCompleted,
      }));

    // Guest metrics
    const totalGuests = wedding.guests.length;
    let attending = 0;
    let pending = 0;
    let declined = 0;
    let totalHeadcount = 0;

    for (const guest of wedding.guests) {
      if (guest.rsvpStatus === 'ATTENDING') {
        attending += 1;
        totalHeadcount += 1 + (guest.plusOneCount || 0);
      } else if (guest.rsvpStatus === 'PENDING') {
        pending += 1;
      } else if (guest.rsvpStatus === 'DECLINED') {
        declined += 1;
      }
    }

    return {
      user,
      hasWedding: true,
      wedding: {
        id: wedding.id,
        date: wedding.date.toISOString(),
        location: wedding.location,
        totalBudget,
        daysToGo,
      },
      budget: {
        totalBudget,
        totalSpent,
        remainingBudget,
        spentPercentage,
      },
      events: upcomingEvents.slice(0, DASHBOARD_LIST_LIMIT),
      upcomingEventsCount: upcomingEvents.length,
      nextEvent,
      tasks: {
        totalTasks,
        completedTasks,
        pendingTasks,
        completedPercentage,
      },
      upcomingTasks,
      guests: {
        totalGuests,
        attending,
        pending,
        declined,
        totalHeadcount,
      },
    };
  }
}
