import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from '../customer/wedding-scope.service';
import { ProcessService } from './process.service';

jest.mock('../../generated/prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(
      message: string,
      public code: string,
    ) {
      super(message);
    }
  }
  return {
    PrismaClient: class {},
    Prisma: { PrismaClientKnownRequestError },
    ProcessState: {
      NEW: 'NEW',
      READY: 'READY',
      RUNNING: 'RUNNING',
      WAITING: 'WAITING',
      COMPLETED: 'COMPLETED',
    },
    UserRole: { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
  };
});

jest.mock('../prisma/prisma.service');

import { Prisma } from '../../generated/prisma/client';

// The mocked client exposes a simplified (message, code) constructor.
const DuplicateError = Prisma.PrismaClientKnownRequestError as unknown as new (
  message: string,
  code: string,
) => Error;

const record = (state: string, overrides: Record<string, unknown> = {}) => ({
  id: 'proc-1',
  taskId: 'task-1',
  weddingId: 'wed-1',
  pidNumber: 1,
  state,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  startedAt: null,
  completedAt: null,
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  task: { id: 'task-1', title: 'Book caterer' },
  ...overrides,
});

describe('ProcessService', () => {
  let service: ProcessService;
  let prismaMock: {
    wedding: { findUnique: jest.Mock };
    task: { findFirst: jest.Mock };
    taskProcess: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      wedding: { findUnique: jest.fn() },
      task: { findFirst: jest.fn() },
      taskProcess: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessService,
        WeddingScopeService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ProcessService);
    prismaMock.wedding.findUnique.mockResolvedValue({
      id: 'wed-1',
      totalBudget: '0.00',
    });
  });

  /** Drives a transition from `from` and returns the update() call arguments. */
  const runTransition = async (from: string, to: string) => {
    prismaMock.taskProcess.findFirst.mockResolvedValue(record(from));
    prismaMock.taskProcess.update.mockResolvedValue(record(to));
    const result = await service.transition('cust-1', 'proc-1', {
      targetState: to as never,
    });
    const calls = prismaMock.taskProcess.update.mock.calls as {
      data: Record<string, unknown>;
    }[][];
    return { result, data: calls[0][0].data };
  };

  it('creates a NEW process with the next pid for the wedding', async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: 'task-1' });
    prismaMock.taskProcess.findFirst.mockResolvedValue({ pidNumber: 4 });
    prismaMock.taskProcess.create.mockResolvedValue(
      record('NEW', { pidNumber: 5 }),
    );

    const result = await service.create('cust-1', { taskId: 'task-1' });

    expect(prismaMock.taskProcess.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          taskId: 'task-1',
          weddingId: 'wed-1',
          pidNumber: 5,
          state: 'NEW',
        },
      }),
    );
    expect(result.pid).toBe('P5');
    expect(result.state).toBe('NEW');
    expect(result.name).toBe('Book caterer');
    expect(result.allowedTransitions).toEqual(['READY']);
  });

  it('rejects creating a process from another wedding task', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);

    await expect(
      service.create('cust-1', { taskId: 'task-other' }),
    ).rejects.toThrow('Task not found for your wedding');
    expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
      where: { id: 'task-other', weddingId: 'wed-1' },
      select: { id: true },
    });
    expect(prismaMock.taskProcess.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate process for the same task', async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: 'task-1' });
    prismaMock.taskProcess.findFirst.mockResolvedValue({ pidNumber: 1 });
    prismaMock.taskProcess.create.mockRejectedValue(
      new DuplicateError('duplicate', 'P2002'),
    );

    await expect(
      service.create('cust-1', { taskId: 'task-1' }),
    ).rejects.toThrow('This task already has a process');
  });

  it('moves NEW to READY', async () => {
    const { result } = await runTransition('NEW', 'READY');
    expect(result.state).toBe('READY');
    expect(result.allowedTransitions).toEqual(['RUNNING', 'COMPLETED']);
  });

  it('dispatches READY to RUNNING and stamps startedAt', async () => {
    const { data } = await runTransition('READY', 'RUNNING');
    expect(data.state).toBe('RUNNING');
    expect(data.startedAt).toBeInstanceOf(Date);
  });

  it('blocks RUNNING to WAITING', async () => {
    const { result, data } = await runTransition('RUNNING', 'WAITING');
    expect(result.state).toBe('WAITING');
    expect(data.startedAt).toBeUndefined();
  });

  it('wakes WAITING to READY', async () => {
    const { result } = await runTransition('WAITING', 'READY');
    expect(result.state).toBe('READY');
  });

  it('completes RUNNING and stamps completedAt', async () => {
    const { data } = await runTransition('RUNNING', 'COMPLETED');
    expect(data.state).toBe('COMPLETED');
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it('terminates a READY process straight to COMPLETED', async () => {
    const { result } = await runTransition('READY', 'COMPLETED');
    expect(result.state).toBe('COMPLETED');
    expect(result.allowedTransitions).toEqual([]);
  });

  it.each([
    ['NEW', 'RUNNING'],
    ['WAITING', 'RUNNING'],
    ['NEW', 'COMPLETED'],
  ])('rejects the invalid transition %s -> %s', async (from, to) => {
    prismaMock.taskProcess.findFirst.mockResolvedValue(record(from));

    await expect(
      service.transition('cust-1', 'proc-1', { targetState: to as never }),
    ).rejects.toThrow(`Cannot move a ${from} process to ${to}`);
    expect(prismaMock.taskProcess.update).not.toHaveBeenCalled();
  });

  it('does not let a COMPLETED process transition again', async () => {
    prismaMock.taskProcess.findFirst.mockResolvedValue(record('COMPLETED'));

    await expect(
      service.transition('cust-1', 'proc-1', { targetState: 'READY' }),
    ).rejects.toThrow('A COMPLETED process cannot change state');
    expect(prismaMock.taskProcess.update).not.toHaveBeenCalled();
  });

  it('does not expose a process from another wedding', async () => {
    prismaMock.taskProcess.findFirst.mockResolvedValue(null);

    await expect(service.get('cust-1', 'proc-other')).rejects.toThrow(
      'Process not found',
    );
    expect(prismaMock.taskProcess.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proc-other', weddingId: 'wed-1' },
      }),
    );
  });

  it('lists only the processes of the caller wedding', async () => {
    prismaMock.taskProcess.findMany.mockResolvedValue([record('READY')]);

    const result = await service.list('cust-1');

    expect(prismaMock.taskProcess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { weddingId: 'wed-1' },
        orderBy: { pidNumber: 'asc' },
      }),
    );
    expect(result[0].pid).toBe('P1');
  });
});
