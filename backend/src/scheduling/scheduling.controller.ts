import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma/client';
import { SchedulingService } from './scheduling.service';
import { RunScheduleDto } from './dto/run-schedule.dto';

@Controller('customer/scheduling')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post('run')
  run(@CurrentUser() user: { id: string }, @Body() dto: RunScheduleDto) {
    return this.schedulingService.run(user.id, dto);
  }
}
