import {
  Body,
  Controller,
  Delete,
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
import { GuestService } from './guest.service';
import { EventService } from './event.service';
import { ExpenseService } from './expense.service';
import { TaskService } from './task.service';
import { CreateGuestDto, UpdateGuestDto } from './dto/guest.dto';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

/**
 * Wedding planning CRUD for the authenticated customer. The owning wedding is
 * always resolved server-side from the JWT user.
 */
@Controller('customer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class PlanningController {
  constructor(
    private readonly guestService: GuestService,
    private readonly eventService: EventService,
    private readonly expenseService: ExpenseService,
    private readonly taskService: TaskService,
  ) {}

  // ── Guests ──
  @Get('guests')
  listGuests(@CurrentUser() user: { id: string }) {
    return this.guestService.list(user.id);
  }

  @Post('guests')
  createGuest(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateGuestDto,
  ) {
    return this.guestService.create(user.id, dto);
  }

  @Get('guests/:id')
  getGuest(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.guestService.get(user.id, id);
  }

  @Patch('guests/:id')
  updateGuest(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestService.update(user.id, id, dto);
  }

  @Delete('guests/:id')
  removeGuest(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.guestService.remove(user.id, id);
  }

  // ── Events ──
  @Get('events')
  listEvents(@CurrentUser() user: { id: string }) {
    return this.eventService.list(user.id);
  }

  @Post('events')
  createEvent(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateEventDto,
  ) {
    return this.eventService.create(user.id, dto);
  }

  @Get('events/:id')
  getEvent(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.eventService.get(user.id, id);
  }

  @Patch('events/:id')
  updateEvent(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.update(user.id, id, dto);
  }

  @Delete('events/:id')
  removeEvent(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.eventService.remove(user.id, id);
  }

  // ── Expenses ──
  @Get('expenses')
  listExpenses(@CurrentUser() user: { id: string }) {
    return this.expenseService.list(user.id);
  }

  @Post('expenses')
  createExpense(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenseService.create(user.id, dto);
  }

  @Get('expenses/:id')
  getExpense(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.expenseService.get(user.id, id);
  }

  @Patch('expenses/:id')
  updateExpense(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenseService.update(user.id, id, dto);
  }

  @Delete('expenses/:id')
  removeExpense(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.expenseService.remove(user.id, id);
  }

  // ── Tasks ──
  @Get('tasks')
  listTasks(@CurrentUser() user: { id: string }) {
    return this.taskService.list(user.id);
  }

  @Post('tasks')
  createTask(@CurrentUser() user: { id: string }, @Body() dto: CreateTaskDto) {
    return this.taskService.create(user.id, dto);
  }

  @Get('tasks/:id')
  getTask(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.taskService.get(user.id, id);
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(user.id, id, dto);
  }

  @Delete('tasks/:id')
  removeTask(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.taskService.remove(user.id, id);
  }
}
