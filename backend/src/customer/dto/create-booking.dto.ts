import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID('4', { message: 'A valid vendor must be selected' })
  vendorId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Service date must use the YYYY-MM-DD format',
  })
  serviceDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Message must be 500 characters or less' })
  message?: string;
}
