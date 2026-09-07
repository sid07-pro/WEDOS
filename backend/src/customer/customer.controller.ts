import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma/client';
import { CreateWeddingDto } from './dto/create-wedding.dto';
import { UpdateWeddingDto } from './dto/update-wedding.dto';
import { ListVendorsDto } from './dto/list-vendors.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingService } from './booking.service';
import { VendorDiscoveryService } from './vendor-discovery.service';

@Controller('customer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly vendorDiscoveryService: VendorDiscoveryService,
    private readonly bookingService: BookingService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.CUSTOMER)
  async getDashboard(@CurrentUser() user: { id: string }) {
    return this.customerService.getDashboard(user.id);
  }

  @Get('wedding')
  @Roles(UserRole.CUSTOMER)
  async getWedding(@CurrentUser() user: { id: string }) {
    return this.customerService.getWedding(user.id);
  }

  @Post('wedding')
  @Roles(UserRole.CUSTOMER)
  async createWedding(
    @CurrentUser() user: { id: string },
    @Body() createWeddingDto: CreateWeddingDto,
  ) {
    return this.customerService.createWedding(user.id, createWeddingDto);
  }

  @Patch('wedding')
  @Roles(UserRole.CUSTOMER)
  async updateWedding(
    @CurrentUser() user: { id: string },
    @Body() updateWeddingDto: UpdateWeddingDto,
  ) {
    return this.customerService.updateWedding(user.id, updateWeddingDto);
  }

  @Get('vendors')
  @Roles(UserRole.CUSTOMER)
  async listVendors(@Query() filters: ListVendorsDto) {
    return this.vendorDiscoveryService.listVendors(filters);
  }

  @Get('vendors/:id')
  @Roles(UserRole.CUSTOMER)
  async getVendor(@Param('id') id: string) {
    return this.vendorDiscoveryService.getVendor(id);
  }

  @Post('bookings')
  @Roles(UserRole.CUSTOMER)
  async createBooking(
    @CurrentUser() user: { id: string },
    @Body() createBookingDto: CreateBookingDto,
  ) {
    return this.bookingService.createBooking(user.id, createBookingDto);
  }

  @Get('bookings')
  @Roles(UserRole.CUSTOMER)
  async listBookings(@CurrentUser() user: { id: string }) {
    return this.bookingService.listBookings(user.id);
  }

  @Get('bookings/:id')
  @Roles(UserRole.CUSTOMER)
  async getBooking(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.bookingService.getBooking(user.id, id);
  }
}
