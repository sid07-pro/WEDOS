import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProcessDto {
  /** Task belonging to the authenticated customer's wedding. */
  @IsString()
  @IsNotEmpty({ message: 'A task must be selected' })
  taskId: string;
}
