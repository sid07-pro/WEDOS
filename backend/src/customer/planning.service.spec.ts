import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from './wedding-scope.service';
import { GuestService } from './guest.service';
import { EventService } from './event.service';
import { ExpenseService } from './expense.service';
import { TaskService } from './task.service';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  RsvpStatus: {
    PENDING: 'PENDING',
    ATTENDING: 'ATTENDING',
    DECLINED: 'DECLINED',
  },
  UserRole: { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
}));

jest.mock('../prisma/prisma.service');

type Mock = jest.Mock;

describe('Planning services', () => {
  let guests: GuestService;
  let events: EventService;
  let expenses: ExpenseService;
  let tasks: TaskService;
  let prismaMock: {
    wedding: { findUnique: Mock };
    guest: { findMany: Mock; findFirst: Mock; create: Mock; delete: Mock };
    event: { findMany: Mock; findFirst: Mock; create: Mock; update: Mock };
    expense: { findMany: Mock; findFirst: Mock; create: Mock };
    task: { findMany: Mock; findFirst: Mock; create: Mock; update: Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      wedding: { findUnique: jest.fn() },
      guest: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      event: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      expense: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      task: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeddingScopeService,
        GuestService,
        EventService,
        ExpenseService,
        TaskService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    guests = module.get(GuestService);
    events = module.get(EventService);
    expenses = module.get(ExpenseService);
    tasks = module.get(TaskService);

    prismaMock.wedding.findUnique.mockResolvedValue({
      id: 'wed-1',
      totalBudget: '1500000.00',
    });
  });

  it('rejects planning access when the customer has no wedding', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue(null);

    await expect(guests.list('cust-1')).rejects.toThrow(
      'Create your wedding before managing this section',
    );
    expect(prismaMock.guest.findMany).not.toHaveBeenCalled();
  });

  it('summarises guests and scopes the query to the resolved wedding', async () => {
    prismaMock.guest.findMany.mockResolvedValue([
      {
        id: 'g1',
        name: 'A',
        email: null,
        rsvpStatus: 'ATTENDING',
        plusOneCount: 1,
      },
      {
        id: 'g2',
        name: 'B',
        email: null,
        rsvpStatus: 'PENDING',
        plusOneCount: 0,
      },
      {
        id: 'g3',
        name: 'C',
        email: null,
        rsvpStatus: 'DECLINED',
        plusOneCount: 2,
      },
    ]);

    const result = await guests.list('cust-1');

    expect(prismaMock.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { weddingId: 'wed-1' } }),
    );
    expect(result.summary).toEqual({
      totalGuests: 3,
      attending: 1,
      pending: 1,
      declined: 1,
      totalHeadcount: 2,
    });
  });

  it('does not return a guest belonging to another wedding', async () => {
    prismaMock.guest.findFirst.mockResolvedValue(null);

    await expect(guests.get('cust-1', 'g-other')).rejects.toThrow(
      'Guest not found',
    );
    expect(prismaMock.guest.findFirst).toHaveBeenCalledWith({
      where: { id: 'g-other', weddingId: 'wed-1' },
    });
    expect(prismaMock.guest.delete).not.toHaveBeenCalled();
  });

  it('rejects an event whose end time is not after its start time', async () => {
    await expect(
      events.create('cust-1', {
        name: 'Mehendi',
        startTime: '2026-12-12T18:00',
        endTime: '2026-12-12T18:00',
      }),
    ).rejects.toThrow('End time must be after the start time');
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it('stores an event as a UTC calendar timestamp', async () => {
    prismaMock.event.create.mockResolvedValue({
      id: 'ev-1',
      name: 'Mehendi',
      startTime: new Date('2026-12-12T10:00:00Z'),
      endTime: new Date('2026-12-12T18:00:00Z'),
      location: 'Delhi',
    });

    const result = await events.create('cust-1', {
      name: '  Mehendi  ',
      startTime: '2026-12-12T10:00',
      endTime: '2026-12-12T18:00',
      location: '  Delhi  ',
    });

    expect(prismaMock.event.create).toHaveBeenCalledWith({
      data: {
        weddingId: 'wed-1',
        name: 'Mehendi',
        startTime: new Date('2026-12-12T10:00:00.000Z'),
        endTime: new Date('2026-12-12T18:00:00.000Z'),
        location: 'Delhi',
      },
    });
    expect(result.startTime).toBe('2026-12-12T10:00:00.000Z');
  });

  it('totals expenses without floating-point drift', async () => {
    prismaMock.expense.findMany.mockResolvedValue([
      { id: 'e1', title: 'A', amount: '0.10', category: 'Venue', isPaid: true },
      {
        id: 'e2',
        title: 'B',
        amount: '0.20',
        category: 'Venue',
        isPaid: false,
      },
      {
        id: 'e3',
        title: 'C',
        amount: '1000.05',
        category: 'Food',
        isPaid: true,
      },
    ]);

    const result = await expenses.list('cust-1');

    expect(result.summary.totalSpent).toBe(1000.35);
    expect(result.summary.paidAmount).toBe(1000.15);
    expect(result.summary.unpaidAmount).toBe(0.2);
    expect(result.summary.remainingBudget).toBe(1498999.65);
    expect(result.expenses[0].amount).toBe('0.10');
    expect(result.categories).toEqual(['Food', 'Venue']);
  });

  it('orders tasks incomplete-first and reports pending totals', async () => {
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Book caterer',
        dueDate: new Date('2026-11-01T00:00:00Z'),
        isCompleted: false,
      },
      { id: 't2', title: 'Pick venue', dueDate: null, isCompleted: true },
    ]);

    const result = await tasks.list('cust-1');

    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: { weddingId: 'wed-1' },
      orderBy: [{ isCompleted: 'asc' }, { dueDate: 'asc' }],
    });
    expect(result.summary).toEqual({
      totalTasks: 2,
      completedTasks: 1,
      pendingTasks: 1,
      completedPercentage: 50,
    });
    expect(result.tasks[1].dueDate).toBeNull();
  });

  it('scopes a task completion update to the caller wedding', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 't1',
      title: 'Book caterer',
      dueDate: new Date('2026-11-01T00:00:00Z'),
      isCompleted: false,
    });
    prismaMock.task.update.mockResolvedValue({
      id: 't1',
      title: 'Book caterer',
      dueDate: new Date('2026-11-01T00:00:00Z'),
      isCompleted: true,
    });

    const result = await tasks.update('cust-1', 't1', { isCompleted: true });

    expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
      where: { id: 't1', weddingId: 'wed-1' },
    });
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { isCompleted: true },
    });
    expect(result.isCompleted).toBe(true);
  });
});
