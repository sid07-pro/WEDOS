import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from '../customer/wedding-scope.service';
import { ResourceService } from '../resource/resource.service';
import { ResourceLockService } from './resource-lock.service';
import { SyncDemoService } from './sync-demo.service';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  AllocationStatus: { ALLOCATED: 'ALLOCATED', RELEASED: 'RELEASED' },
  BookingStatus: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
  },
  UserRole: { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
  VendorCategory: { PHOTOGRAPHY: 'PHOTOGRAPHY' },
}));

jest.mock('../prisma/prisma.service');

/** Yields the event loop so a competing request can interleave. */
const tick = () => new Promise((resolve) => setImmediate(resolve));

interface Row {
  id: string;
  weddingId: string;
  vendorId: string;
  bookingId: string;
  status: string;
  allocatedAt: Date;
  releasedAt: Date | null;
}

/**
 * In-memory stand-in for the allocations table. `create` intentionally enforces
 * no uniqueness, so these tests isolate what the application-level lock
 * contributes rather than what the database index would catch. `findFirst`
 * reads and then yields the event loop, reproducing the exact interleaving that
 * lets two unsynchronized requests both observe the resource as free.
 */
function makePrismaMock(rows: Row[]) {
  const booking = {
    id: 'bk-1',
    weddingId: 'wed-1',
    vendorId: 'vp-1',
    status: 'ACCEPTED',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    serviceDate: new Date('2026-12-12T00:00:00Z'),
    vendor: {
      id: 'vp-1',
      businessName: 'Rajan Kapoor Photography',
      category: 'PHOTOGRAPHY',
      location: 'Delhi',
    },
  };

  const client = {
    wedding: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'wed-1', totalBudget: '0.00' }),
    },
    booking: {
      findMany: jest.fn().mockResolvedValue([booking]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'bk-1',
        vendorId: 'vp-1',
        status: 'ACCEPTED',
      }),
    },
    resourceAllocation: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: { status?: string; vendorId?: string };
        }) => {
          // Read first, then yield the event loop. That is the real race window:
          // a competing request can now run its own check before this one acts
          // on the (already stale) result.
          const found =
            rows.find(
              (row) =>
                row.vendorId === where.vendorId &&
                (!where.status || row.status === where.status),
            ) ?? null;
          await tick();
          return found;
        },
      ),
      findMany: jest.fn(
        ({ where }: { where: { status?: string; weddingId?: string } }) =>
          Promise.resolve(
            rows.filter(
              (row) =>
                (!where.status || row.status === where.status) &&
                (!where.weddingId || row.weddingId === where.weddingId),
            ),
          ),
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<Row, 'id' | 'allocatedAt' | 'releasedAt'>;
        }) => {
          const row: Row = {
            id: `alloc-${rows.length + 1}`,
            allocatedAt: new Date('2026-09-02T00:00:00Z'),
            releasedAt: null,
            ...data,
          };
          rows.push(row);
          return Promise.resolve(row);
        },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
  };

  client.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(client),
  );

  return client;
}

describe('SyncDemoService', () => {
  let service: SyncDemoService;
  let resourceService: ResourceService;
  let rows: Row[];

  beforeEach(async () => {
    rows = [];
    const prismaMock = makePrismaMock(rows);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncDemoService,
        ResourceService,
        ResourceLockService,
        WeddingScopeService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(SyncDemoService);
    resourceService = module.get(ResourceService);
  });

  it('lets exactly one of two concurrent allocations win', async () => {
    const result = await service.simulateContention('cust-1', 'vp-1', 'bk-1');

    expect(result.granted).toBe(1);
    expect(result.denied).toBe(1);
    // Only one row was actually written.
    expect(rows.filter((row) => row.status === 'ALLOCATED')).toHaveLength(1);
  });

  it('tells the losing request the resource is already allocated', async () => {
    const result = await service.simulateContention('cust-1', 'vp-1', 'bk-1');
    const denied = result.attempts.find((a) => a.outcome === 'DENIED');

    expect(denied).toBeDefined();
    expect(denied?.message).toContain('already allocated');
    expect(result.resource.state).toBe('ALLOCATED');
    expect(result.resource.heldByThisWedding).toBe(true);
  });

  it('serializes competing direct allocation requests on the same resource', async () => {
    const settled = await Promise.allSettled([
      resourceService.request('cust-1', 'vp-1', { bookingId: 'bk-1' }),
      resourceService.request('cust-1', 'vp-1', { bookingId: 'bk-1' }),
      resourceService.request('cust-1', 'vp-1', { bookingId: 'bk-1' }),
    ]);

    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((r) => r.status === 'rejected')).toHaveLength(2);
    expect(rows).toHaveLength(1);
  });

  it('reports no locks held once the demo has finished', async () => {
    await service.simulateContention('cust-1', 'vp-1', 'bk-1');

    expect(service.activeLocks()).toEqual([]);
  });
});
