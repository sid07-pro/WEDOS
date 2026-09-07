import { Module } from '@nestjs/common';
import { VendorController } from './vendor.controller';
import { VendorBookingService } from './vendor-booking.service';

@Module({
  controllers: [VendorController],
  providers: [VendorBookingService],
  exports: [VendorBookingService],
})
export class VendorModule {}
