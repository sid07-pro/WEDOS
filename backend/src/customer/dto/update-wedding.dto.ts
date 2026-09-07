import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateWeddingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Wedding date must use the YYYY-MM-DD format',
  })
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Wedding location is required' })
  @MaxLength(250, {
    message: 'Wedding location must be 250 characters or less',
  })
  location: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, {
    message:
      'Total budget must be a non-negative amount with up to two decimal places',
  })
  @MaxLength(13, { message: 'Total budget is too large' })
  totalBudget: string;
}
