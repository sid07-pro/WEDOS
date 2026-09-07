import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma/client';
import { ProcessService } from './process.service';
import { CreateProcessDto } from './dto/create-process.dto';
import { TransitionProcessDto } from './dto/transition-process.dto';

@Controller('customer/processes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  @Get('lifecycle')
  getLifecycle() {
    return { transitions: this.processService.getLifecycle() };
  }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.processService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateProcessDto) {
    return this.processService.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.processService.get(user.id, id);
  }

  @Patch(':id/transition')
  transition(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: TransitionProcessDto,
  ) {
    return this.processService.transition(user.id, id, dto);
  }
}
