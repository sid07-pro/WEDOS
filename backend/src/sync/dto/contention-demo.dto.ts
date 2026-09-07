import { IsNotEmpty, IsString } from 'class-validator';

export class ContentionDemoDto {
  /** Booking of the authenticated customer that the demo requests against. */
  @IsString()
  @IsNotEmpty({ message: 'A booking must be selected' })
  bookingId: string;
}
