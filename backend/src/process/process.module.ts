import { Module } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { ProcessController } from './process.controller';
import { ProcessService } from './process.service';

@Module({
  imports: [CustomerModule],
  controllers: [ProcessController],
  providers: [ProcessService],
})
export class ProcessModule {}
