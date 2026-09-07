import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListVendorsDto } from './dto/list-vendors.dto';
import { Prisma, VendorCategory } from '../../generated/prisma/client';

/** Public vendor information a customer is allowed to see. */
export interface VendorSummary {
  id: string;
  businessName: string;
  category: VendorCategory;
  description: string;
  startingPrice: string;
  imageUrl: string | null;
  location: string;
}

export interface VendorDetails extends VendorSummary {
  /** Business contact name only — no email, credentials or other user fields. */
  contactName: string;
}

/**
 * Read-only vendor discovery for customers. Bookings (Phase 6) will build on the
 * same VendorProfile records, so nothing here is vendor-owner specific.
 */
@Injectable()
export class VendorDiscoveryService {
  constructor(private prisma: PrismaService) {}

  async listVendors(filters: ListVendorsDto): Promise<VendorSummary[]> {
    const where: Prisma.VendorProfileWhereInput = {};

    if (filters.category) {
      where.category = filters.category;
    }

    const location = filters.location?.trim();
    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const vendors = await this.prisma.vendorProfile.findMany({
      where,
      orderBy: { businessName: 'asc' },
      select: this.publicSelect,
    });

    return vendors.map((vendor) => this.toSummary(vendor));
  }

  async getVendor(vendorId: string): Promise<VendorDetails> {
    const id = vendorId?.trim();

    if (!id) {
      throw new NotFoundException('Vendor not found');
    }

    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id },
      select: {
        ...this.publicSelect,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return {
      ...this.toSummary(vendor),
      contactName: `${vendor.user.firstName} ${vendor.user.lastName}`.trim(),
    };
  }

  private readonly publicSelect = {
    id: true,
    businessName: true,
    category: true,
    description: true,
    startingPrice: true,
    imageUrl: true,
    location: true,
  } as const;

  private toSummary(vendor: {
    id: string;
    businessName: string;
    category: VendorCategory;
    description: string;
    startingPrice: { toString(): string };
    imageUrl: string | null;
    location: string;
  }): VendorSummary {
    return {
      id: vendor.id,
      businessName: vendor.businessName,
      category: vendor.category,
      description: vendor.description,
      startingPrice: vendor.startingPrice.toString(),
      imageUrl: vendor.imageUrl,
      location: vendor.location,
    };
  }
}
