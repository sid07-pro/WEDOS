import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RsvpStatus } from '../../../generated/prisma/client';

const MAX_PLUS_ONES = 20;

export class CreateGuestDto {
  @IsString()
  @IsNotEmpty({ message: 'Guest name is required' })
  @MaxLength(120, { message: 'Guest name must be 120 characters or less' })
  name: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsEnum(RsvpStatus, { message: 'Unknown RSVP status' })
  rsvpStatus?: RsvpStatus;

  @IsOptional()
  @IsInt({ message: 'Plus-one count must be a whole number' })
  @Min(0, { message: 'Plus-one count cannot be negative' })
  @Max(MAX_PLUS_ONES, {
    message: `Plus-one count cannot exceed ${MAX_PLUS_ONES}`,
  })
  plusOneCount?: number;
}

export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Guest name is required' })
  @MaxLength(120, { message: 'Guest name must be 120 characters or less' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsEnum(RsvpStatus, { message: 'Unknown RSVP status' })
  rsvpStatus?: RsvpStatus;

  @IsOptional()
  @IsInt({ message: 'Plus-one count must be a whole number' })
  @Min(0, { message: 'Plus-one count cannot be negative' })
  @Max(MAX_PLUS_ONES, {
    message: `Plus-one count cannot exceed ${MAX_PLUS_ONES}`,
  })
  plusOneCount?: number;
}
