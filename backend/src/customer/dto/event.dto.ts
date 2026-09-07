import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Local calendar timestamp, e.g. 2026-12-12T18:30 */
export const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATETIME_MESSAGE = 'Use the YYYY-MM-DDTHH:mm format';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty({ message: 'Event name is required' })
  @MaxLength(120, { message: 'Event name must be 120 characters or less' })
  name: string;

  @IsString()
  @Matches(DATETIME_PATTERN, { message: `Start time: ${DATETIME_MESSAGE}` })
  startTime: string;

  @IsString()
  @Matches(DATETIME_PATTERN, { message: `End time: ${DATETIME_MESSAGE}` })
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'Location must be 250 characters or less' })
  location?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Event name is required' })
  @MaxLength(120, { message: 'Event name must be 120 characters or less' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(DATETIME_PATTERN, { message: `Start time: ${DATETIME_MESSAGE}` })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(DATETIME_PATTERN, { message: `End time: ${DATETIME_MESSAGE}` })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'Location must be 250 characters or less' })
  location?: string;
}
