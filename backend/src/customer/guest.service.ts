import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeddingScopeService } from './wedding-scope.service';
import { CreateGuestDto, UpdateGuestDto } from './dto/guest.dto';
import { Guest, RsvpStatus } from '../../generated/prisma/client';

export interface GuestResponse {
  id: string;
  name: string;
  email: string | null;
  rsvpStatus: RsvpStatus;
  plusOneCount: number;
}

export interface GuestListResponse {
  guests: GuestResponse[];
  summary: {
    totalGuests: number;
    attending: number;
    pending: number;
    declined: number;
    totalHeadcount: number;
  };
}

@Injectable()
export class GuestService {
  constructor(
    private prisma: PrismaService,
    private weddingScope: WeddingScopeService,
  ) {}

  async list(userId: string): Promise<GuestListResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const guests = await this.prisma.guest.findMany({
      where: { weddingId },
      orderBy: { name: 'asc' },
    });

    const summary = {
      totalGuests: guests.length,
      attending: 0,
      pending: 0,
      declined: 0,
      totalHeadcount: 0,
    };

    for (const guest of guests) {
      if (guest.rsvpStatus === RsvpStatus.ATTENDING) {
        summary.attending += 1;
        summary.totalHeadcount += 1 + guest.plusOneCount;
      } else if (guest.rsvpStatus === RsvpStatus.PENDING) {
        summary.pending += 1;
      } else {
        summary.declined += 1;
      }
    }

    return { guests: guests.map((guest) => this.toResponse(guest)), summary };
  }

  async get(userId: string, guestId: string): Promise<GuestResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    return this.toResponse(await this.findOwned(weddingId, guestId));
  }

  async create(userId: string, dto: CreateGuestDto): Promise<GuestResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const guest = await this.prisma.guest.create({
      data: {
        weddingId,
        name: dto.name.trim(),
        email: this.normalizeEmail(dto.email),
        rsvpStatus: dto.rsvpStatus ?? RsvpStatus.PENDING,
        plusOneCount: dto.plusOneCount ?? 0,
      },
    });

    return this.toResponse(guest);
  }

  async update(
    userId: string,
    guestId: string,
    dto: UpdateGuestDto,
  ): Promise<GuestResponse> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, guestId);

    const guest = await this.prisma.guest.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined
          ? { email: this.normalizeEmail(dto.email) }
          : {}),
        ...(dto.rsvpStatus !== undefined ? { rsvpStatus: dto.rsvpStatus } : {}),
        ...(dto.plusOneCount !== undefined
          ? { plusOneCount: dto.plusOneCount }
          : {}),
      },
    });

    return this.toResponse(guest);
  }

  async remove(userId: string, guestId: string): Promise<{ id: string }> {
    const weddingId = await this.weddingScope.requireWeddingId(userId);
    const existing = await this.findOwned(weddingId, guestId);

    await this.prisma.guest.delete({ where: { id: existing.id } });

    return { id: existing.id };
  }

  /** Ownership is part of the query, so another wedding's id resolves to null. */
  private async findOwned(weddingId: string, guestId: string): Promise<Guest> {
    const id = guestId?.trim();
    const guest = id
      ? await this.prisma.guest.findFirst({ where: { id, weddingId } })
      : null;

    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    return guest;
  }

  private normalizeEmail(email?: string): string | null {
    const trimmed = email?.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }

  private toResponse(guest: Guest): GuestResponse {
    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      rsvpStatus: guest.rsvpStatus,
      plusOneCount: guest.plusOneCount,
    };
  }
}
