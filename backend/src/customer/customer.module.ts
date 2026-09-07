import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { PlanningController } from './planning.controller';
import { CustomerService } from './customer.service';
import { VendorDiscoveryService } from './vendor-discovery.service';
import { BookingService } from './booking.service';
import { WeddingScopeService } from './wedding-scope.service';
import { GuestService } from './guest.service';
import { EventService } from './event.service';
import { ExpenseService } from './expense.service';
import { TaskService } from './task.service';

@Module({
  controllers: [CustomerController, PlanningController],
  providers: [
    CustomerService,
    VendorDiscoveryService,
    BookingService,
    WeddingScopeService,
    GuestService,
    EventService,
    ExpenseService,
    TaskService,
  ],
  exports: [
    CustomerService,
    VendorDiscoveryService,
    BookingService,
    WeddingScopeService,
  ],
})
export class CustomerModule {}
