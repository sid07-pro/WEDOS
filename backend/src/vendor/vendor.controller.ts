import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma/client';
import { VendorBookingService } from './vendor-booking.service';

@Controller('vendor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorController {
  constructor(private readonly vendorBookingService: VendorBookingService) {}

  @Get('bookings')
  @Roles(UserRole.VENDOR)
  async listBookings(@CurrentUser() user: { id: string }) {
    return this.vendorBookingService.listBookings(user.id);
  }

  @Get('bookings/:id')
  @Roles(UserRole.VENDOR)
  async getBooking(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.vendorBookingService.getBooking(user.id, id);
  }

  @Patch('bookings/:id/accept')
  @Roles(UserRole.VENDOR)
  async acceptBooking(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.vendorBookingService.acceptBooking(user.id, id);
  }

  @Patch('bookings/:id/reject')
  @Roles(UserRole.VENDOR)
  async rejectBooking(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.vendorBookingService.rejectBooking(user.id, id);
  }
}
