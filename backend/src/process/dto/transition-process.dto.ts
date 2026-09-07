import { IsIn } from 'class-validator';
import { ProcessState } from '../../../generated/prisma/client';

/** Only the target state is accepted — never a raw record mutation. */
const TARGET_STATES = [
  ProcessState.READY,
  ProcessState.RUNNING,
  ProcessState.WAITING,
  ProcessState.COMPLETED,
] as const;

export class TransitionProcessDto {
  @IsIn(TARGET_STATES, { message: 'Unknown target process state' })
  targetState: (typeof TARGET_STATES)[number];
}
