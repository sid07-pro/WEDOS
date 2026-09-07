import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { VendorCategory } from '../../../generated/prisma/client';

export class ListVendorsDto {
  @IsOptional()
  @IsEnum(VendorCategory, { message: 'Unknown vendor category' })
  category?: VendorCategory;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
