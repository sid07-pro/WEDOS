import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma/client';
import { SyncDemoService } from './sync-demo.service';
import { ContentionDemoDto } from './dto/contention-demo.dto';

@Controller('customer/sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class SyncController {
  constructor(private readonly syncDemoService: SyncDemoService) {}

  @Get('locks')
  locks() {
    return { activeLocks: this.syncDemoService.activeLocks() };
  }

  @Post('resources/:id/contention-demo')
  contentionDemo(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ContentionDemoDto,
  ) {
    return this.syncDemoService.simulateContention(user.id, id, dto.bookingId);
  }
}
