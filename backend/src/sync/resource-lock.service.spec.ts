import { ResourceLockService } from './resource-lock.service';

/** Yields the event loop, letting a competing operation interleave. */
const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('ResourceLockService', () => {
  let lock: ResourceLockService;

  beforeEach(() => {
    lock = new ResourceLockService();
  });

  it('acquires the lock while the critical section runs', async () => {
    let observed = false;

    await lock.runExclusive('res-1', async () => {
      observed = lock.isLocked('res-1');
      await tick();
    });

    expect(observed).toBe(true);
  });

  it('releases the lock after normal execution', async () => {
    await lock.runExclusive('res-1', () => Promise.resolve('done'));

    expect(lock.isLocked('res-1')).toBe(false);
    expect(lock.activeLocks()).toEqual([]);
  });

  it('releases the lock when the critical section throws', async () => {
    await expect(
      lock.runExclusive('res-1', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    expect(lock.isLocked('res-1')).toBe(false);
    // The resource is not permanently locked — it can be acquired again.
    await expect(
      lock.runExclusive('res-1', () => Promise.resolve('ok')),
    ).resolves.toBe('ok');
  });

  it('serializes two concurrent operations on the same key', async () => {
    const events: string[] = [];

    const critical = (name: string) => async () => {
      events.push(`${name}:enter`);
      await tick();
      await tick();
      events.push(`${name}:exit`);
    };

    await Promise.all([
      lock.runExclusive('res-1', critical('A')),
      lock.runExclusive('res-1', critical('B')),
    ]);

    // No interleaving: each section fully completes before the next starts.
    expect(events).toEqual(['A:enter', 'A:exit', 'B:enter', 'B:exit']);
  });

  it('does not block unrelated resources', async () => {
    const events: string[] = [];

    const critical = (name: string) => async () => {
      events.push(`${name}:enter`);
      await tick();
      events.push(`${name}:exit`);
    };

    await Promise.all([
      lock.runExclusive('res-1', critical('A')),
      lock.runExclusive('res-2', critical('B')),
    ]);

    // Different keys run concurrently, so their sections interleave.
    expect(events).toEqual(['A:enter', 'B:enter', 'A:exit', 'B:exit']);
  });

  it('preserves the result of the critical section', async () => {
    await expect(
      lock.runExclusive('res-1', () => Promise.resolve(42)),
    ).resolves.toBe(42);
  });
});
