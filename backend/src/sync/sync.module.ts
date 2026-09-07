import { Module } from '@nestjs/common';
import { ResourceModule } from '../resource/resource.module';
import { SyncController } from './sync.controller';
import { SyncDemoService } from './sync-demo.service';

@Module({
  imports: [ResourceModule],
  controllers: [SyncController],
  providers: [SyncDemoService],
})
export class SyncModule {}
