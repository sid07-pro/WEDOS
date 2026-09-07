import { ProcessState } from '../../generated/prisma/client';

/**
 * Application-level simulation of an OS process lifecycle. A WEDOS wedding task
 * is the source entity; these are NOT operating-system kernel processes.
 *
 * Lifecycle:
 *   NEW -> READY -> RUNNING -> WAITING -> READY
 *   RUNNING -> COMPLETED
 *   READY   -> COMPLETED   (terminate a process that never ran)
 */
export const PROCESS_TRANSITIONS: Record<ProcessState, ProcessState[]> = {
  NEW: [ProcessState.READY],
  READY: [ProcessState.RUNNING, ProcessState.COMPLETED],
  RUNNING: [ProcessState.WAITING, ProcessState.COMPLETED],
  WAITING: [ProcessState.READY],
  COMPLETED: [],
};

export function canTransition(from: ProcessState, to: ProcessState): boolean {
  return PROCESS_TRANSITIONS[from].includes(to);
}

/** States a process may move to right now — drives the mobile action buttons. */
export function allowedTransitions(from: ProcessState): ProcessState[] {
  return [...PROCESS_TRANSITIONS[from]];
}

export function transitionErrorMessage(
  from: ProcessState,
  to: ProcessState,
): string {
  if (PROCESS_TRANSITIONS[from].length === 0) {
    return `A ${from} process cannot change state`;
  }
  return `Cannot move a ${from} process to ${to}. Allowed: ${PROCESS_TRANSITIONS[
    from
  ].join(', ')}`;
}
