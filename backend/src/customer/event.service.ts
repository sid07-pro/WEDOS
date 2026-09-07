import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from './wedding-scope.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { Event } from '../../generated/prisma/client';

export interface EventResponse {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  location: string;
}

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private weddingScope: WeddingScopeService,
  ) {}

  async list(userId: string): Promise<EventResponse[]> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const events = await this.prisma.event.findMany({
      where: { weddingId },
      orderBy: { startTime: 'asc' },
    });

    return events.map((event) => this.toResponse(event));
  }

  async get(userId: string, eventId: string): Promise<EventResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    return this.toResponse(await this.findOwned(weddingId, eventId));
  }

  async create(userId: string, dto: CreateEventDto): Promise<EventResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const startTime = this.parseDateTime(dto.startTime, 'Start time');
    const endTime = this.parseDateTime(dto.endTime, 'End time');
    this.assertChronological(startTime, endTime);

    const event = await this.prisma.event.create({
      data: {
        weddingId,
        name: dto.name.trim(),
        startTime,
        endTime,
        location: dto.location?.trim() ?? '',
      },
    });

    return this.toResponse(event);
  }

  async update(
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
  ): Promise<EventResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, eventId);

    const startTime =
      dto.startTime !== undefined
        ? this.parseDateTime(dto.startTime, 'Start time')
        : existing.startTime;
    const endTime =
      dto.endTime !== undefined
        ? this.parseDateTime(dto.endTime, 'End time')
        : existing.endTime;
    this.assertChronological(startTime, endTime);

    const event = await this.prisma.event.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.location !== undefined
          ? { location: dto.location.trim() }
          : {}),
        startTime,
        endTime,
      },
    });

    return this.toResponse(event);
  }

  async remove(userId: string, eventId: string): Promise<{ id: string }> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, eventId);

    await this.prisma.event.delete({ where: { id: existing.id } });

    return { id: existing.id };
  }

  private async findOwned(weddingId: string, eventId: string): Promise<Event> {
    const id = eventId?.trim();
    const event = id
      ? await this.prisma.event.findFirst({ where: { id, weddingId } })
      : null;

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  /** Parses a YYYY-MM-DDTHH:mm calendar timestamp as UTC. */
  private parseDateTime(value: string, label: string): Date {
    const [datePart, timePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute));

    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day ||
      date.getUTCHours() !== hour ||
      date.getUTCMinutes() !== minute
    ) {
      throw new BadRequestException(`${label} is invalid`);
    }

    return date;
  }

  private assertChronological(startTime: Date, endTime: Date): void {
    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException('End time must be after the start time');
    }
  }

  private toResponse(event: Event): EventResponse {
    return {
      id: event.id,
      name: event.name,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      location: event.location,
    };
  }
}
