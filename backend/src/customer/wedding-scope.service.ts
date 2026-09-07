import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves the wedding that belongs to the authenticated customer. Every planning
 * module scopes its queries through this, so a client-supplied weddingId is never
 * used for authorization.
 */
@Injectable()
export class WeddingScopeService {
  constructor(private prisma: PrismaService) {}

  async requireWedding(
    userId: string,
  ): Promise<{ id: string; totalBudget: { toString(): string } }> {
    const wedding = await this.prisma.wedding.findUnique({
      where: { customerId: userId },
      select: { id: true, totalBudget: true },
    });

    if (!wedding) {
      throw new BadRequestException(
        'Create your wedding before managing this section',
      );
    }

    return wedding;
  }

  async requireWeddingId(userId: string): Promise<string> {
    return (await this.requireWedding(userId)).id;
  }
}
