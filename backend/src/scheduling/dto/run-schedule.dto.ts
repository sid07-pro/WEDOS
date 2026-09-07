import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SCHEDULING_ALGORITHMS, SchedulingAlgorithm } from '../cpu-scheduler';

const MAX_PROCESSES = 20;

export class ScheduleProcessDto {
  /** Id of a task belonging to the authenticated customer's wedding. */
  @IsString()
  @IsNotEmpty({ message: 'A task must be selected for every process' })
  taskId: string;

  @IsInt({ message: 'Arrival time must be a whole number' })
  @Min(0, { message: 'Arrival time cannot be negative' })
  @Max(10_000)
  arrivalTime: number;

  @IsInt({ message: 'Burst time must be a whole number' })
  @Min(1, { message: 'Burst time must be at least 1' })
  @Max(1_000)
  burstTime: number;

  /** Lower number means higher scheduling priority. */
  @IsInt({ message: 'Priority must be a whole number' })
  @Min(1, { message: 'Priority must be at least 1' })
  @Max(100)
  priority: number;
}

export class RunScheduleDto {
  @IsIn(SCHEDULING_ALGORITHMS, { message: 'Unknown scheduling algorithm' })
  algorithm: SchedulingAlgorithm;

  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one task to schedule' })
  @ArrayMaxSize(MAX_PROCESSES, {
    message: `Schedule at most ${MAX_PROCESSES} tasks at a time`,
  })
  @ValidateNested({ each: true })
  @Type(() => ScheduleProcessDto)
  processes: ScheduleProcessDto[];

  @IsOptional()
  @IsInt({ message: 'Time quantum must be a whole number' })
  @Min(1, { message: 'Time quantum must be at least 1' })
  @Max(1_000)
  timeQuantum?: number;
}
