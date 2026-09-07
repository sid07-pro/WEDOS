/**
 * Application-level simulation of classic CPU scheduling algorithms.
 *
 * These are NOT real OS kernel processes. A WEDOS wedding task is mapped onto a
 * schedulable job so the algorithms can be demonstrated on real user data:
 *
 *   WEDOS Task  -> process
 *   pid         -> scheduling process identifier (assigned per run, 1..n)
 *   arrivalTime -> the time unit at which the process becomes ready
 *   burstTime   -> CPU burst required to complete the process
 *   priority    -> scheduling priority, LOWER NUMBER = HIGHER PRIORITY
 *
 * Time is measured in abstract, non-negative integer units.
 */

export const SCHEDULING_ALGORITHMS = [
  'FCFS',
  'SJF',
  'PRIORITY',
  'ROUND_ROBIN',
] as const;

export type SchedulingAlgorithm = (typeof SCHEDULING_ALGORITHMS)[number];

export interface SchedulerProcess {
  pid: number;
  taskId: string;
  label: string;
  arrivalTime: number;
  burstTime: number;
  priority: number;
}

export interface GanttSegment {
  pid: number;
  taskId: string;
  label: string;
  startTime: number;
  endTime: number;
}

export interface ProcessMetrics {
  pid: number;
  taskId: string;
  label: string;
  arrivalTime: number;
  burstTime: number;
  priority: number;
  /** First time the process got the CPU. */
  startTime: number;
  completionTime: number;
  turnaroundTime: number;
  waitingTime: number;
  responseTime: number;
}

export interface ScheduleResult {
  algorithm: SchedulingAlgorithm;
  timeQuantum: number | null;
  gantt: GanttSegment[];
  metrics: ProcessMetrics[];
  averages: {
    waitingTime: number;
    turnaroundTime: number;
    responseTime: number;
  };
  totalTime: number;
}

export class SchedulingInputError extends Error {}

/** Rounds to 3 decimals so averages do not carry binary floating-point noise. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function assertValid(
  processes: SchedulerProcess[],
  algorithm: SchedulingAlgorithm,
  timeQuantum?: number,
): void {
  if (processes.length === 0) {
    throw new SchedulingInputError('At least one process is required');
  }

  const seen = new Set<number>();
  for (const process of processes) {
    if (seen.has(process.pid)) {
      throw new SchedulingInputError(`Duplicate process id ${process.pid}`);
    }
    seen.add(process.pid);

    if (!Number.isInteger(process.arrivalTime) || process.arrivalTime < 0) {
      throw new SchedulingInputError(
        `Arrival time for ${process.label} must be a non-negative whole number`,
      );
    }
    if (!Number.isInteger(process.burstTime) || process.burstTime <= 0) {
      throw new SchedulingInputError(
        `Burst time for ${process.label} must be a positive whole number`,
      );
    }
    if (!Number.isInteger(process.priority) || process.priority < 1) {
      throw new SchedulingInputError(
        `Priority for ${process.label} must be a whole number of at least 1`,
      );
    }
  }

  if (algorithm === 'ROUND_ROBIN') {
    if (
      timeQuantum === undefined ||
      !Number.isInteger(timeQuantum) ||
      timeQuantum <= 0
    ) {
      throw new SchedulingInputError(
        'Round Robin requires a positive whole time quantum',
      );
    }
  }
}

function toSegment(
  process: SchedulerProcess,
  startTime: number,
  endTime: number,
): GanttSegment {
  return {
    pid: process.pid,
    taskId: process.taskId,
    label: process.label,
    startTime,
    endTime,
  };
}

/** Builds per-process metrics from the completed Gantt timeline. */
function buildResult(
  algorithm: SchedulingAlgorithm,
  processes: SchedulerProcess[],
  gantt: GanttSegment[],
  timeQuantum: number | null,
): ScheduleResult {
  const metrics: ProcessMetrics[] = processes.map((process) => {
    const own = gantt.filter((segment) => segment.pid === process.pid);
    const startTime = own[0].startTime;
    const completionTime = own[own.length - 1].endTime;
    const turnaroundTime = completionTime - process.arrivalTime;

    return {
      pid: process.pid,
      taskId: process.taskId,
      label: process.label,
      arrivalTime: process.arrivalTime,
      burstTime: process.burstTime,
      priority: process.priority,
      startTime,
      completionTime,
      turnaroundTime,
      waitingTime: turnaroundTime - process.burstTime,
      responseTime: startTime - process.arrivalTime,
    };
  });

  const count = metrics.length;
  const sum = (pick: (m: ProcessMetrics) => number) =>
    metrics.reduce((total, m) => total + pick(m), 0);

  return {
    algorithm,
    timeQuantum,
    gantt,
    metrics,
    averages: {
      waitingTime: round(sum((m) => m.waitingTime) / count),
      turnaroundTime: round(sum((m) => m.turnaroundTime) / count),
      responseTime: round(sum((m) => m.responseTime) / count),
    },
    totalTime: gantt.length > 0 ? gantt[gantt.length - 1].endTime : 0,
  };
}

/** First Come First Serve — runs each process to completion in arrival order. */
function runFcfs(processes: SchedulerProcess[]): GanttSegment[] {
  const queue = [...processes].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || a.pid - b.pid,
  );

  const gantt: GanttSegment[] = [];
  let clock = 0;

  for (const process of queue) {
    // The CPU idles until the next process arrives.
    const start = Math.max(clock, process.arrivalTime);
    clock = start + process.burstTime;
    gantt.push(toSegment(process, start, clock));
  }

  return gantt;
}

/**
 * Shared non-preemptive driver for SJF and Priority: repeatedly pick the best
 * process among those that have arrived, then run it to completion.
 */
function runNonPreemptive(
  processes: SchedulerProcess[],
  isBetter: (candidate: SchedulerProcess, best: SchedulerProcess) => boolean,
): GanttSegment[] {
  const pending = [...processes];
  const gantt: GanttSegment[] = [];
  let clock = 0;

  while (pending.length > 0) {
    const arrived = pending.filter((p) => p.arrivalTime <= clock);

    if (arrived.length === 0) {
      // Idle gap: jump the clock to the earliest remaining arrival.
      clock = Math.min(...pending.map((p) => p.arrivalTime));
      continue;
    }

    const chosen = arrived.reduce((best, candidate) =>
      isBetter(candidate, best) ? candidate : best,
    );

    const start = Math.max(clock, chosen.arrivalTime);
    clock = start + chosen.burstTime;
    gantt.push(toSegment(chosen, start, clock));
    pending.splice(pending.indexOf(chosen), 1);
  }

  return gantt;
}

/** Shortest Job First, non-preemptive. Ties: earlier arrival, then lower pid. */
function runSjf(processes: SchedulerProcess[]): GanttSegment[] {
  return runNonPreemptive(
    processes,
    (candidate, best) =>
      candidate.burstTime < best.burstTime ||
      (candidate.burstTime === best.burstTime &&
        (candidate.arrivalTime < best.arrivalTime ||
          (candidate.arrivalTime === best.arrivalTime &&
            candidate.pid < best.pid))),
  );
}

/**
 * Priority scheduling, non-preemptive. A LOWER priority number means a HIGHER
 * scheduling priority. Ties: earlier arrival, then lower pid.
 */
function runPriority(processes: SchedulerProcess[]): GanttSegment[] {
  return runNonPreemptive(
    processes,
    (candidate, best) =>
      candidate.priority < best.priority ||
      (candidate.priority === best.priority &&
        (candidate.arrivalTime < best.arrivalTime ||
          (candidate.arrivalTime === best.arrivalTime &&
            candidate.pid < best.pid))),
  );
}

/**
 * Round Robin, preemptive. Each process runs for at most one quantum before
 * going to the back of the ready queue, so a process can appear in several
 * Gantt segments. Segments are not merged, which keeps every preemption visible.
 */
function runRoundRobin(
  processes: SchedulerProcess[],
  timeQuantum: number,
): GanttSegment[] {
  const ordered = [...processes].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || a.pid - b.pid,
  );
  const remaining = new Map(ordered.map((p) => [p.pid, p.burstTime]));

  const gantt: GanttSegment[] = [];
  const ready: SchedulerProcess[] = [];
  let clock = 0;
  let nextArrival = 0;

  /** Moves every process that has arrived by `upTo` into the ready queue. */
  const admit = (upTo: number) => {
    while (
      nextArrival < ordered.length &&
      ordered[nextArrival].arrivalTime <= upTo
    ) {
      ready.push(ordered[nextArrival]);
      nextArrival += 1;
    }
  };

  admit(clock);

  while (ready.length > 0 || nextArrival < ordered.length) {
    if (ready.length === 0) {
      // Idle gap: jump to the next arrival.
      clock = ordered[nextArrival].arrivalTime;
      admit(clock);
      continue;
    }

    const current = ready.shift()!;
    const left = remaining.get(current.pid)!;
    const slice = Math.min(timeQuantum, left);
    const start = clock;
    clock = start + slice;
    remaining.set(current.pid, left - slice);
    gantt.push(toSegment(current, start, clock));

    // Processes that arrived during this slice queue ahead of the preempted one.
    admit(clock);
    if (remaining.get(current.pid)! > 0) {
      ready.push(current);
    }
  }

  return gantt;
}

export function schedule(
  algorithm: SchedulingAlgorithm,
  processes: SchedulerProcess[],
  timeQuantum?: number,
): ScheduleResult {
  assertValid(processes, algorithm, timeQuantum);

  switch (algorithm) {
    case 'FCFS':
      return buildResult(algorithm, processes, runFcfs(processes), null);
    case 'SJF':
      return buildResult(algorithm, processes, runSjf(processes), null);
    case 'PRIORITY':
      return buildResult(algorithm, processes, runPriority(processes), null);
    case 'ROUND_ROBIN':
      return buildResult(
        algorithm,
        processes,
        runRoundRobin(processes, timeQuantum as number),
        timeQuantum as number,
      );
  }
}
