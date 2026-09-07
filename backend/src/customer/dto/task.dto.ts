import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Due date must use the YYYY-MM-DD format';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Task title is required' })
  @MaxLength(150, { message: 'Task title must be 150 characters or less' })
  title: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  dueDate: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Task title is required' })
  @MaxLength(150, { message: 'Task title must be 150 characters or less' })
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
