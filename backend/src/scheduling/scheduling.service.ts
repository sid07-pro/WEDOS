import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from '../customer/wedding-scope.service';
import { RunScheduleDto } from './dto/run-schedule.dto';
import {
  schedule,
  SchedulerProcess,
  ScheduleResult,
  SchedulingInputError,
} from './cpu-scheduler';

@Injectable()
export class SchedulingService {
  constructor(
    private prisma: PrismaService,
    private weddingScope: WeddingScopeService,
  ) {}

  /**
   * Runs a CPU scheduling simulation over real tasks of the authenticated
   * customer's wedding. Process labels come from the database, never the client.
   */
  async run(userId: string, dto: RunScheduleDto): Promise<ScheduleResult> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);

    const taskIds = dto.processes.map((process) => process.taskId);
    const uniqueTaskIds = [...new Set(taskIds)];

    if (uniqueTaskIds.length !== taskIds.length) {
      throw new BadRequestException(
        'The same task cannot be scheduled more than once',
      );
    }

    // Ownership is part of the query, so tasks from another wedding never match.
    const tasks = await this.prisma.task.findMany({
      where: { weddingId, id: { in: uniqueTaskIds } },
      select: { id: true, title: true },
    });

    if (tasks.length !== uniqueTaskIds.length) {
      throw new BadRequestException(
        'One or more selected tasks were not found for your wedding',
      );
    }

    const titleById = new Map(tasks.map((task) => [task.id, task.title]));

    // pid is assigned in submission order, which makes every run deterministic.
    const processes: SchedulerProcess[] = dto.processes.map(
      (process, index) => ({
        pid: index + 1,
        taskId: process.taskId,
        label: titleById.get(process.taskId) as string,
        arrivalTime: process.arrivalTime,
        burstTime: process.burstTime,
        priority: process.priority,
      }),
    );

    try {
      return schedule(dto.algorithm, processes, dto.timeQuantum);
    } catch (error) {
      if (error instanceof SchedulingInputError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
