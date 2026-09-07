import { Module } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';
import { ResourceLockService } from '../sync/resource-lock.service';

@Module({
  imports: [CustomerModule],
  controllers: [ResourceController],
  providers: [ResourceService, ResourceLockService],
  exports: [ResourceService, ResourceLockService],
})
export class ResourceModule {}
