import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingStatus,
  Prisma,
  VendorCategory,
} from '../../generated/prisma/client';

/** Booking as the owning customer sees it, with public vendor details attached. */
export interface CustomerBookingResponse {
  id: string;
  status: BookingStatus;
  message: string | null;
  serviceDate: string;
  createdAt: string;
  updatedAt: string;
  vendor: {
    id: string;
    businessName: string;
    category: VendorCategory;
    location: string;
    startingPrice: string;
  };
}

const bookingWithVendor = {
  vendor: {
    select: {
      id: true,
      businessName: true,
      category: true,
      location: true,
      startingPrice: true,
    },
  },
} as const;

type BookingWithVendor = Prisma.BookingGetPayload<{
  include: typeof bookingWithVendor;
}>;

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async createBooking(
    userId: string,
    dto: CreateBookingDto,
  ): Promise<CustomerBookingResponse> {
    const serviceDate = this.parseServiceDate(dto.serviceDate);

    // The wedding is always resolved from the authenticated customer — a client
    // supplied weddingId is never accepted.
    const wedding = await this.prisma.wedding.findUnique({
      where: { customerId: userId },
      select: { id: true },
    });

    if (!wedding) {
      throw new BadRequestException(
        'Create your wedding before requesting a booking',
      );
    }

    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: dto.vendorId },
      select: { id: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const message = dto.message?.trim() || null;

    try {
      const booking = await this.prisma.booking.create({
        data: {
          weddingId: wedding.id,
          vendorId: vendor.id,
          serviceDate,
          message,
          status: BookingStatus.PENDING,
        },
        include: bookingWithVendor,
      });

      return this.toResponse(booking);
    } catch (error) {
      // Relies on the @@unique([weddingId, vendorId]) constraint rather than a
      // read-then-write check, so concurrent requests cannot both succeed.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You have already requested a booking with this vendor',
        );
      }
      throw error;
    }
  }

  async listBookings(userId: string): Promise<CustomerBookingResponse[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { wedding: { customerId: userId } },
      orderBy: { createdAt: 'desc' },
      include: bookingWithVendor,
    });

    return bookings.map((booking) => this.toResponse(booking));
  }

  async getBooking(
    userId: string,
    bookingId: string,
  ): Promise<CustomerBookingResponse> {
    const id = bookingId?.trim();

    if (!id) {
      throw new NotFoundException('Booking not found');
    }

    // Ownership is part of the query, so another customer's id resolves to null.
    const booking = await this.prisma.booking.findFirst({
      where: { id, wedding: { customerId: userId } },
      include: bookingWithVendor,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.toResponse(booking);
  }

  private parseServiceDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Service date is invalid');
    }

    return date;
  }

  private toResponse(booking: BookingWithVendor): CustomerBookingResponse {
    return {
      id: booking.id,
      status: booking.status,
      message: booking.message,
      serviceDate: booking.serviceDate.toISOString(),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      vendor: {
        id: booking.vendor.id,
        businessName: booking.vendor.businessName,
        category: booking.vendor.category,
        location: booking.vendor.location,
        startingPrice: booking.vendor.startingPrice.toString(),
      },
    };
  }
}
