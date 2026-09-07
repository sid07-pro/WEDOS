import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from '../customer/wedding-scope.service';
import { ResourceLockService } from '../sync/resource-lock.service';
import { RequestResourceDto } from './dto/request-resource.dto';
import {
  AllocationStatus,
  BookingStatus,
  Prisma,
  VendorCategory,
} from '../../generated/prisma/client';

/**
 * Application-level simulation of OS resource allocation.
 *
 *   VendorProfile        -> resource
 *   Booking request      -> resource request
 *   Accepted allocation  -> resource allocation
 *   Released allocation  -> resource release
 *
 * These are NOT operating-system kernel resources.
 */
export type ResourceState = 'AVAILABLE' | 'ALLOCATED' | 'RELEASED';

export interface ResourceView {
  /** Resource id — the VendorProfile id. */
  id: string;
  name: string;
  category: VendorCategory;
  location: string;
  state: ResourceState;
  /** True when this wedding holds the active allocation. */
  heldByThisWedding: boolean;
  canRequest: boolean;
  canRelease: boolean;
  booking: {
    id: string;
    status: BookingStatus;
    serviceDate: string;
  } | null;
  allocation: {
    id: string;
    status: AllocationStatus;
    allocatedAt: string;
    releasedAt: string | null;
  } | null;
}

@Injectable()
export class ResourceService {
  constructor(
    private prisma: PrismaService,
    private weddingScope: WeddingScopeService,
    private lock: ResourceLockService,
  ) {}

  /**
   * Resources relevant to this wedding: every vendor the customer has a booking
   * with, plus the current allocation state of that resource.
   */
  async list(userId: string): Promise<ResourceView[]> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);

    const bookings = await this.prisma.booking.findMany({
      where: { weddingId },
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: {
            id: true,
            businessName: true,
            category: true,
            location: true,
          },
        },
      },
    });

    if (bookings.length === 0) {
      return [];
    }

    const vendorIds = bookings.map((booking) => booking.vendorId);

    // Active allocations by anyone — that is what makes a resource unavailable.
    const active = await this.prisma.resourceAllocation.findMany({
      where: {
        vendorId: { in: vendorIds },
        status: AllocationStatus.ALLOCATED,
      },
    });
    const activeByVendor = new Map(active.map((a) => [a.vendorId, a]));

    // This wedding's most recent released allocation, for the RELEASED state.
    const released = await this.prisma.resourceAllocation.findMany({
      where: {
        weddingId,
        vendorId: { in: vendorIds },
        status: AllocationStatus.RELEASED,
      },
      orderBy: { releasedAt: 'desc' },
    });
    const releasedByVendor = new Map<string, (typeof released)[number]>();
    for (const allocation of released) {
      if (!releasedByVendor.has(allocation.vendorId)) {
        releasedByVendor.set(allocation.vendorId, allocation);
      }
    }

    return bookings.map((booking) => {
      const activeAllocation = activeByVendor.get(booking.vendorId) ?? null;
      const heldByThisWedding = activeAllocation?.weddingId === weddingId;
      const lastReleased = releasedByVendor.get(booking.vendorId) ?? null;

      const state: ResourceState = activeAllocation
        ? 'ALLOCATED'
        : lastReleased
          ? 'RELEASED'
          : 'AVAILABLE';

      const shown = activeAllocation ?? lastReleased;

      return {
        id: booking.vendor.id,
        name: booking.vendor.businessName,
        category: booking.vendor.category,
        location: booking.vendor.location,
        state,
        heldByThisWedding,
        // A released resource is reusable: it can be requested again.
        canRequest:
          !activeAllocation && booking.status === BookingStatus.ACCEPTED,
        canRelease: heldByThisWedding,
        booking: {
          id: booking.id,
          status: booking.status,
          serviceDate: booking.serviceDate.toISOString(),
        },
        allocation: shown
          ? {
              id: shown.id,
              status: shown.status,
              allocatedAt: shown.allocatedAt.toISOString(),
              releasedAt: shown.releasedAt
                ? shown.releasedAt.toISOString()
                : null,
            }
          : null,
      };
    });
  }

  async get(userId: string, resourceId: string): Promise<ResourceView> {
    const resources = await this.list(userId);
    const resource = resources.find((item) => item.id === resourceId?.trim());

    if (!resource) {
      throw new NotFoundException('Resource not found for your wedding');
    }

    return resource;
  }

  /** Requests and allocates a resource for one of the customer's bookings. */
  async request(
    userId: string,
    resourceId: string,
    dto: RequestResourceDto,
  ): Promise<ResourceView> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const vendorId = resourceId?.trim();

    // Booking ownership, vendor relationship and eligibility all come from the
    // database; the client only names which booking and resource it means.
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId.trim(), weddingId },
      select: { id: true, vendorId: true, status: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found for your wedding');
    }

    if (booking.vendorId !== vendorId) {
      throw new BadRequestException(
        'This booking is not for the selected resource',
      );
    }

    if (booking.status !== BookingStatus.ACCEPTED) {
      throw new BadRequestException(
        `A ${booking.status.toLowerCase()} booking cannot allocate this resource. The vendor must accept it first.`,
      );
    }

    try {
      // CRITICAL SECTION (Phase 11): the lock is held across the whole
      // check-then-allocate sequence, not just the insert, so two concurrent
      // requests for this resource cannot both observe it as free. The partial
      // unique index on (vendorId) WHERE status = 'ALLOCATED' remains the
      // database-level backstop.
      await this.lock.runExclusive(vendorId, () =>
        this.prisma.$transaction(async (tx) => {
          const held = await tx.resourceAllocation.findFirst({
            where: { vendorId, status: AllocationStatus.ALLOCATED },
            select: { id: true },
          });

          if (held) {
            throw new ConflictException(
              'This resource is already allocated and cannot be allocated again until it is released',
            );
          }

          await tx.resourceAllocation.create({
            data: {
              weddingId,
              vendorId,
              bookingId: booking.id,
              status: AllocationStatus.ALLOCATED,
            },
          });
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This resource is already allocated and cannot be allocated again until it is released',
        );
      }
      throw error;
    }

    return this.get(userId, vendorId);
  }

  /** Releases the active allocation this wedding holds on a resource. */
  async release(userId: string, resourceId: string): Promise<ResourceView> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const vendorId = resourceId?.trim();

    // Ownership is part of the query, so another wedding's allocation never matches.
    const allocation = await this.prisma.resourceAllocation.findFirst({
      where: { vendorId, weddingId, status: AllocationStatus.ALLOCATED },
      select: { id: true },
    });

    if (!allocation) {
      const anyAllocation = await this.prisma.resourceAllocation.findFirst({
        where: { vendorId, weddingId },
        select: { id: true },
      });

      if (anyAllocation) {
        throw new ConflictException(
          'This allocation has already been released',
        );
      }
      throw new NotFoundException(
        'No active allocation found for this resource',
      );
    }

    // Guarded on status so a concurrent release cannot double-release.
    const result = await this.prisma.resourceAllocation.updateMany({
      where: { id: allocation.id, status: AllocationStatus.ALLOCATED },
      data: { status: AllocationStatus.RELEASED, releasedAt: new Date() },
    });

    if (result.count === 0) {
      throw new ConflictException('This allocation has already been released');
    }

    return this.get(userId, vendorId);
  }
}
