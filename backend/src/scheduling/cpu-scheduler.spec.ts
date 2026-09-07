import {
  schedule,
  SchedulerProcess,
  SchedulingInputError,
} from './cpu-scheduler';

function makeProcess(
  pid: number,
  arrivalTime: number,
  burstTime: number,
  priority = 1,
): SchedulerProcess {
  return {
    pid,
    taskId: `task-${pid}`,
    label: `Task ${pid}`,
    arrivalTime,
    burstTime,
    priority,
  };
}

/** Compact [pid, start, end] view of the Gantt timeline. */
const timeline = (
  segments: { pid: number; startTime: number; endTime: number }[],
) => segments.map((s) => [s.pid, s.startTime, s.endTime]);

describe('cpu-scheduler', () => {
  describe('FCFS', () => {
    it('runs processes to completion in arrival order', () => {
      const result = schedule('FCFS', [
        makeProcess(1, 0, 4),
        makeProcess(2, 1, 3),
        makeProcess(3, 2, 2),
      ]);

      expect(timeline(result.gantt)).toEqual([
        [1, 0, 4],
        [2, 4, 7],
        [3, 7, 9],
      ]);
      // CT 4/7/9, TAT 4/6/7, WT 0/3/5, RT 0/3/5
      expect(result.metrics.map((m) => m.completionTime)).toEqual([4, 7, 9]);
      expect(result.metrics.map((m) => m.turnaroundTime)).toEqual([4, 6, 7]);
      expect(result.metrics.map((m) => m.waitingTime)).toEqual([0, 3, 5]);
      expect(result.metrics.map((m) => m.responseTime)).toEqual([0, 3, 5]);
      expect(result.averages).toEqual({
        waitingTime: 2.667,
        turnaroundTime: 5.667,
        responseTime: 2.667,
      });
      expect(result.totalTime).toBe(9);
    });

    it('idles the CPU until the next process arrives', () => {
      const result = schedule('FCFS', [
        makeProcess(1, 0, 2),
        makeProcess(2, 5, 3),
      ]);

      expect(timeline(result.gantt)).toEqual([
        [1, 0, 2],
        [2, 5, 8],
      ]);
      expect(result.metrics[1].waitingTime).toBe(0);
    });
  });

  describe('SJF (non-preemptive)', () => {
    it('picks the shortest job among those that have arrived', () => {
      // P1 runs 0-7. By then P2(4), P3(1), P4(4) have arrived -> P3 goes next.
      const result = schedule('SJF', [
        makeProcess(1, 0, 7),
        makeProcess(2, 2, 4),
        makeProcess(3, 4, 1),
        makeProcess(4, 5, 4),
      ]);

      expect(timeline(result.gantt)).toEqual([
        [1, 0, 7],
        [3, 7, 8],
        [2, 8, 12],
        [4, 12, 16],
      ]);
      expect(result.metrics.map((m) => m.completionTime)).toEqual([
        7, 12, 8, 16,
      ]);
      expect(result.metrics.map((m) => m.waitingTime)).toEqual([0, 6, 3, 7]);
    });

    it('does not let a later shorter job jump ahead before it arrives', () => {
      const result = schedule('SJF', [
        makeProcess(1, 0, 3),
        makeProcess(2, 4, 1),
      ]);

      expect(timeline(result.gantt)).toEqual([
        [1, 0, 3],
        [2, 4, 5],
      ]);
    });

    it('breaks equal burst ties by arrival, then by pid', () => {
      const result = schedule('SJF', [
        makeProcess(1, 0, 5),
        makeProcess(3, 1, 2),
        makeProcess(2, 1, 2),
      ]);

      // P2 and P3 both have burst 2 and arrival 1 -> lower pid first.
      expect(timeline(result.gantt)).toEqual([
        [1, 0, 5],
        [2, 5, 7],
        [3, 7, 9],
      ]);
    });
  });

  describe('Priority (non-preemptive, lower number = higher priority)', () => {
    it('selects the highest priority arrived process', () => {
      const result = schedule('PRIORITY', [
        makeProcess(1, 0, 4, 3),
        makeProcess(2, 1, 3, 1),
        makeProcess(3, 2, 2, 2),
      ]);

      expect(timeline(result.gantt)).toEqual([
        [1, 0, 4],
        [2, 4, 7],
        [3, 7, 9],
      ]);
      expect(result.metrics.map((m) => m.turnaroundTime)).toEqual([4, 6, 7]);
    });

    it('breaks equal priority ties by arrival, then by pid', () => {
      const result = schedule('PRIORITY', [
        makeProcess(1, 0, 2, 5),
        makeProcess(3, 0, 2, 2),
        makeProcess(2, 0, 2, 2),
      ]);

      expect(timeline(result.gantt)).toEqual([
        [2, 0, 2],
        [3, 2, 4],
        [1, 4, 6],
      ]);
    });
  });

  describe('Round Robin (preemptive)', () => {
    it('gives a long process several time slices', () => {
      const result = schedule(
        'ROUND_ROBIN',
        [makeProcess(1, 0, 5), makeProcess(2, 1, 3), makeProcess(3, 2, 1)],
        2,
      );

      expect(timeline(result.gantt)).toEqual([
        [1, 0, 2],
        [2, 2, 4],
        [3, 4, 5],
        [1, 5, 7],
        [2, 7, 8],
        [1, 8, 9],
      ]);
      // P1 appears three times; metrics use its first start and last end.
      expect(result.metrics[0].startTime).toBe(0);
      expect(result.metrics[0].completionTime).toBe(9);
      expect(result.metrics[0].turnaroundTime).toBe(9);
      expect(result.metrics[0].waitingTime).toBe(4);
      expect(result.metrics[0].responseTime).toBe(0);
      expect(result.metrics.map((m) => m.completionTime)).toEqual([9, 8, 5]);
      expect(result.timeQuantum).toBe(2);
    });

    it('idles until the next arrival when the ready queue drains', () => {
      const result = schedule(
        'ROUND_ROBIN',
        [makeProcess(1, 0, 2), makeProcess(2, 6, 2)],
        2,
      );

      expect(timeline(result.gantt)).toEqual([
        [1, 0, 2],
        [2, 6, 8],
      ]);
    });

    it('rejects a non-positive time quantum', () => {
      expect(() => schedule('ROUND_ROBIN', [makeProcess(1, 0, 3)], 0)).toThrow(
        SchedulingInputError,
      );
      expect(() => schedule('ROUND_ROBIN', [makeProcess(1, 0, 3)])).toThrow(
        'Round Robin requires a positive whole time quantum',
      );
    });
  });

  describe('input validation', () => {
    it('rejects duplicate process ids', () => {
      expect(() =>
        schedule('FCFS', [makeProcess(1, 0, 2), makeProcess(1, 1, 2)]),
      ).toThrow('Duplicate process id 1');
    });

    it('rejects a non-positive burst time', () => {
      expect(() => schedule('FCFS', [makeProcess(1, 0, 0)])).toThrow(
        SchedulingInputError,
      );
    });

    it('rejects a negative arrival time', () => {
      expect(() => schedule('FCFS', [makeProcess(1, -1, 2)])).toThrow(
        SchedulingInputError,
      );
    });

    it('rejects an empty process list', () => {
      expect(() => schedule('FCFS', [])).toThrow(
        'At least one process is required',
      );
    });
  });
});
