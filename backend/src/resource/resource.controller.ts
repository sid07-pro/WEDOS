import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma/client';
import { ResourceService } from './resource.service';
import { RequestResourceDto } from './dto/request-resource.dto';

@Controller('customer/resources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.resourceService.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resourceService.get(user.id, id);
  }

  @Post(':id/request')
  request(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: RequestResourceDto,
  ) {
    return this.resourceService.request(user.id, id, dto);
  }

  @Post(':id/release')
  release(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resourceService.release(user.id, id);
  }
}
