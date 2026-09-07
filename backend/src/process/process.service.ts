import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from '../customer/wedding-scope.service';
import { CreateProcessDto } from './dto/create-process.dto';
import { TransitionProcessDto } from './dto/transition-process.dto';
import {
  allowedTransitions,
  canTransition,
  PROCESS_TRANSITIONS,
  transitionErrorMessage,
} from './process-state';
import { Prisma, ProcessState } from '../../generated/prisma/client';

export interface ProcessResponse {
  id: string;
  /** Simulated process identifier, e.g. "P1" — not a real OS PID. */
  pid: string;
  taskId: string;
  name: string;
  state: ProcessState;
  allowedTransitions: ProcessState[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

const withTask = { task: { select: { id: true, title: true } } } as const;

type ProcessRecord = Prisma.TaskProcessGetPayload<{
  include: typeof withTask;
}>;

@Injectable()
export class ProcessService {
  constructor(
    private prisma: PrismaService,
    private weddingScope: WeddingScopeService,
  ) {}

  /** The full transition table, so the UI can explain the lifecycle. */
  getLifecycle(): Record<ProcessState, ProcessState[]> {
    return PROCESS_TRANSITIONS;
  }

  async list(userId: string): Promise<ProcessResponse[]> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const processes = await this.prisma.taskProcess.findMany({
      where: { weddingId },
      orderBy: { pidNumber: 'asc' },
      include: withTask,
    });

    return processes.map((process) => this.toResponse(process));
  }

  async get(userId: string, processId: string): Promise<ProcessResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    return this.toResponse(await this.findOwned(weddingId, processId));
  }

  /** Creates a process in the NEW state from a task of the caller's wedding. */
  async create(
    userId: string,
    dto: CreateProcessDto,
  ): Promise<ProcessResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);

    // Ownership is part of the query, so another wedding's task never matches.
    const task = await this.prisma.task.findFirst({
      where: { id: dto.taskId.trim(), weddingId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found for your wedding');
    }

    const highest = await this.prisma.taskProcess.findFirst({
      where: { weddingId },
      orderBy: { pidNumber: 'desc' },
      select: { pidNumber: true },
    });

    try {
      const process = await this.prisma.taskProcess.create({
        data: {
          taskId: task.id,
          weddingId,
          pidNumber: (highest?.pidNumber ?? 0) + 1,
          state: ProcessState.NEW,
        },
        include: withTask,
      });

      return this.toResponse(process);
    } catch (error) {
      // Unique constraints cover both a duplicate task and a raced pid number.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This task already has a process. Use the existing one.',
        );
      }
      throw error;
    }
  }

  /** Applies a single validated lifecycle transition. */
  async transition(
    userId: string,
    processId: string,
    dto: TransitionProcessDto,
  ): Promise<ProcessResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, processId);
    const target = dto.targetState;

    if (!canTransition(existing.state, target)) {
      throw new BadRequestException(
        transitionErrorMessage(existing.state, target),
      );
    }

    const now = new Date();
    const process = await this.prisma.taskProcess.update({
      where: { id: existing.id },
      data: {
        state: target,
        // First dispatch records the start; completion records the end.
        ...(target === ProcessState.RUNNING && !existing.startedAt
          ? { startedAt: now }
          : {}),
        ...(target === ProcessState.COMPLETED ? { completedAt: now } : {}),
      },
      include: withTask,
    });

    return this.toResponse(process);
  }

  private async findOwned(
    weddingId: string,
    processId: string,
  ): Promise<ProcessRecord> {
    const id = processId?.trim();
    const process = id
      ? await this.prisma.taskProcess.findFirst({
          where: { id, weddingId },
          include: withTask,
        })
      : null;

    if (!process) {
      throw new NotFoundException('Process not found');
    }

    return process;
  }

  private toResponse(process: ProcessRecord): ProcessResponse {
    return {
      id: process.id,
      pid: `P${process.pidNumber}`,
      taskId: process.taskId,
      name: process.task.title,
      state: process.state,
      allowedTransitions: allowedTransitions(process.state),
      createdAt: process.createdAt.toISOString(),
      startedAt: process.startedAt ? process.startedAt.toISOString() : null,
      completedAt: process.completedAt
        ? process.completedAt.toISOString()
        : null,
      updatedAt: process.updatedAt.toISOString(),
    };
  }
}
