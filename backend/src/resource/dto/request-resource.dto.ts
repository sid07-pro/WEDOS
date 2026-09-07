import { IsNotEmpty, IsString } from 'class-validator';

export class RequestResourceDto {
  /** Booking of the authenticated customer that this allocation is for. */
  @IsString()
  @IsNotEmpty({ message: 'A booking must be selected' })
  bookingId: string;
}
