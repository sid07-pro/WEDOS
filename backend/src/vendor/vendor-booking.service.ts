import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, Prisma } from '../../generated/prisma/client';

/** Booking as the owning vendor sees it, with the safe customer fields attached. */
export interface VendorBookingResponse {
  id: string;
  status: BookingStatus;
  message: string | null;
  serviceDate: string;
  createdAt: string;
  updatedAt: string;
  wedding: {
    id: string;
    date: string;
    location: string;
  };
  customer: {
    firstName: string;
    lastName: string;
  };
}

const bookingWithWedding = {
  wedding: {
    select: {
      id: true,
      date: true,
      location: true,
      customer: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

type BookingWithWedding = Prisma.BookingGetPayload<{
  include: typeof bookingWithWedding;
}>;

@Injectable()
export class VendorBookingService {
  constructor(private prisma: PrismaService) {}

  async listBookings(userId: string): Promise<VendorBookingResponse[]> {
    const vendorId = await this.resolveVendorId(userId);

    const bookings = await this.prisma.booking.findMany({
      where: { vendorId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: bookingWithWedding,
    });

    return bookings.map((booking) => this.toResponse(booking));
  }

  async getBooking(
    userId: string,
    bookingId: string,
  ): Promise<VendorBookingResponse> {
    const vendorId = await this.resolveVendorId(userId);
    const booking = await this.findOwnedBooking(vendorId, bookingId);

    return this.toResponse(booking);
  }

  async acceptBooking(
    userId: string,
    bookingId: string,
  ): Promise<VendorBookingResponse> {
    return this.transition(userId, bookingId, BookingStatus.ACCEPTED);
  }

  async rejectBooking(
    userId: string,
    bookingId: string,
  ): Promise<VendorBookingResponse> {
    return this.transition(userId, bookingId, BookingStatus.REJECTED);
  }

  /**
   * Only PENDING → ACCEPTED and PENDING → REJECTED are permitted. The status is
   * part of the update filter so two concurrent decisions cannot both apply.
   */
  private async transition(
    userId: string,
    bookingId: string,
    nextStatus: typeof BookingStatus.ACCEPTED | typeof BookingStatus.REJECTED,
  ): Promise<VendorBookingResponse> {
    const vendorId = await this.resolveVendorId(userId);
    const booking = await this.findOwnedBooking(vendorId, bookingId);

    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException(
        `A booking that is already ${booking.status.toLowerCase()} cannot be changed`,
      );
    }

    const result = await this.prisma.booking.updateMany({
      where: { id: booking.id, vendorId, status: BookingStatus.PENDING },
      data: { status: nextStatus },
    });

    if (result.count === 0) {
      throw new ConflictException('This booking was already decided');
    }

    return this.getBooking(userId, booking.id);
  }

  private async resolveVendorId(userId: string): Promise<string> {
    // Vendor identity always comes from the authenticated user, never the client.
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return profile.id;
  }

  private async findOwnedBooking(
    vendorId: string,
    bookingId: string,
  ): Promise<BookingWithWedding> {
    const id = bookingId?.trim();

    if (!id) {
      throw new NotFoundException('Booking not found');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id, vendorId },
      include: bookingWithWedding,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private toResponse(booking: BookingWithWedding): VendorBookingResponse {
    return {
      id: booking.id,
      status: booking.status,
      message: booking.message,
      serviceDate: booking.serviceDate.toISOString(),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      wedding: {
        id: booking.wedding.id,
        date: booking.wedding.date.toISOString(),
        location: booking.wedding.location,
      },
      customer: {
        firstName: booking.wedding.customer.firstName,
        lastName: booking.wedding.customer.lastName,
      },
    };
  }
}
