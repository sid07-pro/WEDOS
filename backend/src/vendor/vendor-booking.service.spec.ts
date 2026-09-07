import { Test, TestingModule } from '@nestjs/testing';
import { VendorBookingService } from './vendor-booking.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  BookingStatus: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
  },
  UserRole: { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
}));

jest.mock('../prisma/prisma.service');

const bookingRow = (status: string) => ({
  id: 'bk-1',
  status,
  message: 'Please cover the mehendi too.',
  serviceDate: new Date('2026-12-12T00:00:00Z'),
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  wedding: {
    id: 'wed-1',
    date: new Date('2026-12-14T00:00:00Z'),
    location: 'Delhi',
    customer: { firstName: 'Priya', lastName: 'Sharma' },
  },
});

describe('VendorBookingService', () => {
  let service: VendorBookingService;
  let prismaMock: {
    vendorProfile: { findUnique: jest.Mock };
    booking: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      vendorProfile: { findUnique: jest.fn() },
      booking: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorBookingService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<VendorBookingService>(VendorBookingService);
  });

  it('lists only the bookings of the authenticated vendor', async () => {
    prismaMock.vendorProfile.findUnique.mockResolvedValue({ id: 'vp-1' });
    prismaMock.booking.findMany.mockResolvedValue([bookingRow('PENDING')]);

    const result = await service.listBookings('vendor-user-1');

    expect(prismaMock.vendorProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'vendor-user-1' },
      select: { id: true },
    });
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorId: 'vp-1' } }),
    );
    expect(result[0].customer).toEqual({
      firstName: 'Priya',
      lastName: 'Sharma',
    });
  });

  it('moves a pending booking to ACCEPTED', async () => {
    prismaMock.vendorProfile.findUnique.mockResolvedValue({ id: 'vp-1' });
    prismaMock.booking.findFirst
      .mockResolvedValueOnce(bookingRow('PENDING'))
      .mockResolvedValueOnce(bookingRow('ACCEPTED'));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.acceptBooking('vendor-user-1', 'bk-1');

    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'bk-1', vendorId: 'vp-1', status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });
    expect(result.status).toBe('ACCEPTED');
  });

  it('refuses to change a booking that is no longer pending', async () => {
    prismaMock.vendorProfile.findUnique.mockResolvedValue({ id: 'vp-1' });
    prismaMock.booking.findFirst.mockResolvedValue(bookingRow('ACCEPTED'));

    await expect(
      service.rejectBooking('vendor-user-1', 'bk-1'),
    ).rejects.toThrow('A booking that is already accepted cannot be changed');
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it('reports a conflict when a concurrent decision won the race', async () => {
    prismaMock.vendorProfile.findUnique.mockResolvedValue({ id: 'vp-1' });
    prismaMock.booking.findFirst.mockResolvedValue(bookingRow('PENDING'));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.acceptBooking('vendor-user-1', 'bk-1'),
    ).rejects.toThrow('This booking was already decided');
  });

  it('does not return a booking owned by a different vendor', async () => {
    prismaMock.vendorProfile.findUnique.mockResolvedValue({ id: 'vp-1' });
    prismaMock.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.getBooking('vendor-user-1', 'bk-other'),
    ).rejects.toThrow('Booking not found');
    expect(prismaMock.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bk-other', vendorId: 'vp-1' } }),
    );
  });
});
