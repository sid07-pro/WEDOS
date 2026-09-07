import { Injectable } from '@nestjs/common';
import { ResourceService, ResourceView } from '../resource/resource.service';
import { ResourceLockService } from './resource-lock.service';

export interface ContentionAttempt {
  attempt: number;
  outcome: 'ALLOCATED' | 'DENIED';
  message: string;
}

export interface ContentionDemoResult {
  resourceId: string;
  granted: number;
  denied: number;
  attempts: ContentionAttempt[];
  resource: ResourceView;
}

/**
 * Fires two genuinely concurrent allocation requests at the same resource to
 * show that the critical section admits only one of them.
 *
 * Every request goes through the normal ResourceService path, so all Phase 10
 * authorization still applies: the booking must belong to the authenticated
 * customer's wedding and must be ACCEPTED. Nothing here can touch another
 * customer's data, and no artificial delay is used.
 */
@Injectable()
export class SyncDemoService {
  constructor(
    private readonly resourceService: ResourceService,
    private readonly lock: ResourceLockService,
  ) {}

  activeLocks(): string[] {
    return this.lock.activeLocks();
  }

  async simulateContention(
    userId: string,
    resourceId: string,
    bookingId: string,
  ): Promise<ContentionDemoResult> {
    const settled = await Promise.allSettled([
      this.resourceService.request(userId, resourceId, { bookingId }),
      this.resourceService.request(userId, resourceId, { bookingId }),
    ]);

    const attempts: ContentionAttempt[] = settled.map((result, index) => ({
      attempt: index + 1,
      outcome: result.status === 'fulfilled' ? 'ALLOCATED' : 'DENIED',
      message:
        result.status === 'fulfilled'
          ? 'Entered the critical section first and allocated the resource'
          : result.reason instanceof Error
            ? result.reason.message
            : 'Allocation denied',
    }));

    return {
      resourceId,
      granted: attempts.filter((a) => a.outcome === 'ALLOCATED').length,
      denied: attempts.filter((a) => a.outcome === 'DENIED').length,
      attempts,
      resource: await this.resourceService.get(userId, resourceId),
    };
  }
}
