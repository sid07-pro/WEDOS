import { Injectable } from '@nestjs/common';

/**
 * Application-level mutual exclusion for critical sections, keyed by resource.
 *
 * This is a simulation of OS synchronization inside a single Node.js process —
 * it is NOT a kernel mutex or semaphore.
 *
 * Node runs one request at a time, but an `await` inside a critical section
 * yields the event loop, so two requests can interleave between "check whether
 * the resource is free" and "create the allocation". That is the race this lock
 * closes: each key has a promise chain, and a waiter only proceeds once the
 * previous holder has finished, giving strict FIFO serialization per key.
 *
 * Locks are per key, so unrelated resources never block each other.
 */
@Injectable()
export class ResourceLockService {
  /** Tail of the promise chain for each key; a new waiter queues behind it. */
  private readonly tails = new Map<string, Promise<void>>();
  private readonly held = new Set<string>();

  /**
   * Runs `critical` while holding the lock for `key`. The lock is always
   * released, including when `critical` throws, so a failed allocation can
   * never leave a resource permanently locked.
   */
  async runExclusive<T>(key: string, critical: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Queue behind whoever holds the lock; the chain never rejects because
    // `release` is always called in the finally below.
    const chain = previous.then(() => current);
    this.tails.set(key, chain);

    await previous;
    this.held.add(key);

    try {
      return await critical();
    } finally {
      this.held.delete(key);
      // Drop the key once nobody else is queued behind us.
      if (this.tails.get(key) === chain) {
        this.tails.delete(key);
      }
      release();
    }
  }

  isLocked(key: string): boolean {
    return this.held.has(key);
  }

  /** Keys currently inside a critical section — useful for the demo screen. */
  activeLocks(): string[] {
    return [...this.held];
  }
}
