import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

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

// The mocked client exposes a simplified (message, code) constructor.
const DuplicateError = Prisma.PrismaClientKnownRequestError as unknown as new (
  message: string,
  code: string,
) => Error;

const vendorRow = {
  id: 'vp-1',
  businessName: 'Rajan Kapoor Photography',
  category: 'PHOTOGRAPHY',
  location: 'Delhi',
  startingPrice: { toString: () => '50000.00' },
};

const bookingRow = {
  id: 'bk-1',
  status: 'PENDING',
  message: 'Please cover the mehendi too.',
  serviceDate: new Date('2026-12-12T00:00:00Z'),
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  vendor: vendorRow,
};

describe('BookingService', () => {
  let service: BookingService;
  let prismaMock: {
    wedding: { findUnique: jest.Mock };
    vendorProfile: { findUnique: jest.Mock };
    booking: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      wedding: { findUnique: jest.fn() },
      vendorProfile: { findUnique: jest.fn() },
      booking: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  it('creates a PENDING booking against the wedding owned by the caller', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue({ id: 'wed-1' });
    prismaMock.vendorProfile.findUnique.mockResolvedValue({ id: 'vp-1' });
    prismaMock.booking.create.mockResolvedValue(bookingRow);

    const result = await service.createBooking('cust-1', {
      vendorId: 'vp-1',
      serviceDate: '2026-12-12',
      message: '  Please cover the mehendi too.  ',
    });

    expect(prismaMock.wedding.findUnique).toHaveBeenCalledWith({
      where: { customerId: 'cust-1' },
      select: { id: true },
    });
    expect(prismaMock.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          weddingId: 'wed-1',
          vendorId: 'vp-1',
          serviceDate: new Date('2026-12-12T00:00:00.000Z'),
          message: 'Please cover the mehendi too.',
          status: 'PENDING',
        },
      }),
    );
    expect(result.status).toBe('PENDING');
    expect(result.vendor.startingPrice).toBe('50000.00');
  });

  it('rejects a booking request when the customer has no wedding', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue(null);

    await expect(
      service.createBooking('cust-1', {
        vendorId: 'vp-1',
        serviceDate: '2026-12-12',
      }),
    ).rejects.toThrow('Create your wedding before requesting a booking');
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a booking request for an unknown vendor', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue({ id: 'wed-1' });
    prismaMock.vendorProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.createBooking('cust-1', {
        vendorId: 'vp-missing',
        serviceDate: '2026-12-12',
      }),
    ).rejects.toThrow('Vendor not found');
  });

  it('maps the unique-constraint violation to a duplicate booking conflict', async () => {
    prismaMock.wedding.findUnique.mockResolvedValue({ id: 'wed-1' });
    prismaMock.vendorProfile.findUnique.mockResolvedValue({ id: 'vp-1' });
    prismaMock.booking.create.mockRejectedValue(
      new DuplicateError('duplicate', 'P2002'),
    );

    await expect(
      service.createBooking('cust-1', {
        vendorId: 'vp-1',
        serviceDate: '2026-12-12',
      }),
    ).rejects.toThrow('You have already requested a booking with this vendor');
  });

  it('scopes booking lookups to the authenticated customer', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(null);

    await expect(service.getBooking('cust-1', 'bk-other')).rejects.toThrow(
      'Booking not found',
    );
    expect(prismaMock.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bk-other', wedding: { customerId: 'cust-1' } },
      }),
    );
  });

  it('lists only the bookings of the authenticated customer, newest first', async () => {
    prismaMock.booking.findMany.mockResolvedValue([bookingRow]);

    const result = await service.listBookings('cust-1');

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { wedding: { customerId: 'cust-1' } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].vendor.businessName).toBe('Rajan Kapoor Photography');
  });
});
