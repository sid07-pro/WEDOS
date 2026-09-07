import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from '../customer/wedding-scope.service';
import { ResourceService } from './resource.service';
import { ResourceLockService } from '../sync/resource-lock.service';

jest.mock('../../generated/prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(
      message: string,
      public code: string,
    ) {
      super(message);
    }
  }
  return {
    PrismaClient: class {},
    Prisma: { PrismaClientKnownRequestError },
    AllocationStatus: { ALLOCATED: 'ALLOCATED', RELEASED: 'RELEASED' },
    BookingStatus: {
      PENDING: 'PENDING',
      ACCEPTED: 'ACCEPTED',
      REJECTED: 'REJECTED',
      COMPLETED: 'COMPLETED',
    },
    UserRole: { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
    VendorCategory: { PHOTOGRAPHY: 'PHOTOGRAPHY' },
  };
});

jest.mock('../prisma/prisma.service');

import { Prisma } from '../../generated/prisma/client';

// The mocked client exposes a simplified (message, code) constructor.
const DuplicateError = Prisma.PrismaClientKnownRequestError as unknown as new (
  message: string,
  code: string,
) => Error;

const bookingRow = (status = 'ACCEPTED') => ({
  id: 'bk-1',
  weddingId: 'wed-1',
  vendorId: 'vp-1',
  status,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  serviceDate: new Date('2026-12-12T00:00:00Z'),
  vendor: {
    id: 'vp-1',
    businessName: 'Rajan Kapoor Photography',
    category: 'PHOTOGRAPHY',
    location: 'Delhi',
  },
});

const allocationRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'alloc-1',
  weddingId: 'wed-1',
  vendorId: 'vp-1',
  bookingId: 'bk-1',
  status: 'ALLOCATED',
  allocatedAt: new Date('2026-09-02T00:00:00Z'),
  releasedAt: null,
  ...overrides,
});

describe('ResourceService', () => {
  let service: ResourceService;
  let prismaMock: {
    wedding: { findUnique: jest.Mock };
    booking: { findMany: jest.Mock; findFirst: jest.Mock };
    resourceAllocation: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      wedding: { findUnique: jest.fn() },
      booking: { findMany: jest.fn(), findFirst: jest.fn() },
      resourceAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    // Run the transaction callback against the same mock client.
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceService,
        ResourceLockService,
        WeddingScopeService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ResourceService);
    prismaMock.wedding.findUnique.mockResolvedValue({
      id: 'wed-1',
      totalBudget: '0.00',
    });
    prismaMock.booking.findMany.mockResolvedValue([bookingRow()]);
  });

  it('reports an unallocated accepted booking as AVAILABLE and requestable', async () => {
    const [resource] = await service.list('cust-1');

    expect(resource.id).toBe('vp-1');
    expect(resource.name).toBe('Rajan Kapoor Photography');
    expect(resource.state).toBe('AVAILABLE');
    expect(resource.canRequest).toBe(true);
    expect(resource.canRelease).toBe(false);
  });

  it('allocates an available resource against the caller booking', async () => {
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 'bk-1',
      vendorId: 'vp-1',
      status: 'ACCEPTED',
    });
    // Once the row is created, the follow-up list() sees it as active.
    prismaMock.resourceAllocation.findMany.mockImplementation(
      ({ where }: { where: { status?: string } }) =>
        where.status === 'ALLOCATED' &&
        prismaMock.resourceAllocation.create.mock.calls.length > 0
          ? [allocationRow()]
          : [],
    );

    const result = await service.request('cust-1', 'vp-1', {
      bookingId: 'bk-1',
    });

    expect(prismaMock.resourceAllocation.create).toHaveBeenCalledWith({
      data: {
        weddingId: 'wed-1',
        vendorId: 'vp-1',
        bookingId: 'bk-1',
        status: 'ALLOCATED',
      },
    });
    expect(result.state).toBe('ALLOCATED');
    expect(result.heldByThisWedding).toBe(true);
    expect(result.canRelease).toBe(true);
    expect(result.canRequest).toBe(false);
    expect(result.booking?.id).toBe('bk-1');
  });

  it('rejects allocating a resource that is already allocated', async () => {
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 'bk-1',
      vendorId: 'vp-1',
      status: 'ACCEPTED',
    });
    prismaMock.resourceAllocation.findFirst.mockResolvedValue({
      id: 'alloc-other',
    });

    await expect(
      service.request('cust-1', 'vp-1', { bookingId: 'bk-1' }),
    ).rejects.toThrow('already allocated');
    expect(prismaMock.resourceAllocation.create).not.toHaveBeenCalled();
  });

  it('maps the unique-index violation to a duplicate allocation conflict', async () => {
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 'bk-1',
      vendorId: 'vp-1',
      status: 'ACCEPTED',
    });
    prismaMock.resourceAllocation.create.mockRejectedValue(
      new DuplicateError('duplicate', 'P2002'),
    );

    await expect(
      service.request('cust-1', 'vp-1', { bookingId: 'bk-1' }),
    ).rejects.toThrow('already allocated');
  });

  it('refuses to allocate for a rejected booking', async () => {
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 'bk-1',
      vendorId: 'vp-1',
      status: 'REJECTED',
    });

    await expect(
      service.request('cust-1', 'vp-1', { bookingId: 'bk-1' }),
    ).rejects.toThrow('rejected booking cannot allocate this resource');
    expect(prismaMock.resourceAllocation.create).not.toHaveBeenCalled();
  });

  it('refuses a booking that belongs to another wedding', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.request('cust-1', 'vp-1', { bookingId: 'bk-other' }),
    ).rejects.toThrow('Booking not found for your wedding');
    expect(prismaMock.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bk-other', weddingId: 'wed-1' },
      }),
    );
  });

  it('refuses a booking that is not for the selected resource', async () => {
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 'bk-1',
      vendorId: 'vp-other',
      status: 'ACCEPTED',
    });

    await expect(
      service.request('cust-1', 'vp-1', { bookingId: 'bk-1' }),
    ).rejects.toThrow('not for the selected resource');
  });

  it('releases an active allocation and frees the resource for reuse', async () => {
    prismaMock.resourceAllocation.findFirst.mockResolvedValue({
      id: 'alloc-1',
    });
    prismaMock.resourceAllocation.updateMany.mockResolvedValue({ count: 1 });
    // After release: no active allocation, one released row for this wedding.
    prismaMock.resourceAllocation.findMany.mockImplementation(
      ({ where }: { where: { status?: string } }) =>
        where.status === 'RELEASED'
          ? [allocationRow({ status: 'RELEASED', releasedAt: new Date() })]
          : [],
    );

    const result = await service.release('cust-1', 'vp-1');

    expect(prismaMock.resourceAllocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendorId: 'vp-1', weddingId: 'wed-1', status: 'ALLOCATED' },
      }),
    );
    expect(prismaMock.resourceAllocation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alloc-1', status: 'ALLOCATED' },
      }),
    );
    expect(result.state).toBe('RELEASED');
    // Reusable: the accepted booking can request it again.
    expect(result.canRequest).toBe(true);
    expect(result.canRelease).toBe(false);
  });

  it('does not release an already released allocation', async () => {
    prismaMock.resourceAllocation.findFirst
      .mockResolvedValueOnce(null) // no active allocation
      .mockResolvedValueOnce({ id: 'alloc-1' }); // but a released one exists

    await expect(service.release('cust-1', 'vp-1')).rejects.toThrow(
      'already been released',
    );
    expect(prismaMock.resourceAllocation.updateMany).not.toHaveBeenCalled();
  });

  it("does not release another wedding's allocation", async () => {
    prismaMock.resourceAllocation.findFirst.mockResolvedValue(null);

    await expect(service.release('cust-1', 'vp-1')).rejects.toThrow(
      'No active allocation found for this resource',
    );
    expect(prismaMock.resourceAllocation.updateMany).not.toHaveBeenCalled();
  });

  it('shows a resource held by another wedding as ALLOCATED but not releasable', async () => {
    prismaMock.resourceAllocation.findMany.mockImplementation(
      ({ where }: { where: { status?: string } }) =>
        where.status === 'ALLOCATED'
          ? [allocationRow({ weddingId: 'wed-other' })]
          : [],
    );

    const [resource] = await service.list('cust-1');

    expect(resource.state).toBe('ALLOCATED');
    expect(resource.heldByThisWedding).toBe(false);
    expect(resource.canRequest).toBe(false);
    expect(resource.canRelease).toBe(false);
  });
});
