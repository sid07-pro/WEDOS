import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from './wedding-scope.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { Task } from '../../generated/prisma/client';

export interface TaskResponse {
  id: string;
  title: string;
  /** Null for legacy rows created before a due date was required. */
  dueDate: string | null;
  isCompleted: boolean;
}

export interface TaskListResponse {
  tasks: TaskResponse[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    completedPercentage: number;
  };
}

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private weddingScope: WeddingScopeService,
  ) {}

  async list(userId: string): Promise<TaskListResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    // Incomplete first, then by due date (undated rows last).
    const tasks = await this.prisma.task.findMany({
      where: { weddingId },
      orderBy: [{ isCompleted: 'asc' }, { dueDate: 'asc' }],
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.isCompleted).length;

    return {
      tasks: tasks.map((task) => this.toResponse(task)),
      summary: {
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
        completedPercentage:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
    };
  }

  async get(userId: string, taskId: string): Promise<TaskResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    return this.toResponse(await this.findOwned(weddingId, taskId));
  }

  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const task = await this.prisma.task.create({
      data: {
        weddingId,
        title: dto.title.trim(),
        dueDate: this.parseDueDate(dto.dueDate),
        isCompleted: dto.isCompleted ?? false,
      },
    });

    return this.toResponse(task);
  }

  async update(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, taskId);

    const task = await this.prisma.task.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: this.parseDueDate(dto.dueDate) }
          : {}),
        ...(dto.isCompleted !== undefined
          ? { isCompleted: dto.isCompleted }
          : {}),
      },
    });

    return this.toResponse(task);
  }

  async remove(userId: string, taskId: string): Promise<{ id: string }> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, taskId);

    await this.prisma.task.delete({ where: { id: existing.id } });

    return { id: existing.id };
  }

  private async findOwned(weddingId: string, taskId: string): Promise<Task> {
    const id = taskId?.trim();
    const task = id
      ? await this.prisma.task.findFirst({ where: { id, weddingId } })
      : null;

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private parseDueDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Due date is invalid');
    }

    return date;
  }

  private toResponse(task: Task): TaskResponse {
    return {
      id: task.id,
      title: task.title,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      isCompleted: task.isCompleted,
    };
  }
}
