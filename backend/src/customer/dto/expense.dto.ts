import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Same money format the wedding budget already uses. */
const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const AMOUNT_MESSAGE =
  'Amount must be a non-negative value with up to two decimal places';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty({ message: 'Expense title is required' })
  @MaxLength(120, { message: 'Expense title must be 120 characters or less' })
  title: string;

  @IsString()
  @Matches(AMOUNT_PATTERN, { message: AMOUNT_MESSAGE })
  @MaxLength(13, { message: 'Amount is too large' })
  amount: string;

  @IsString()
  @IsNotEmpty({ message: 'Expense category is required' })
  @MaxLength(60, { message: 'Category must be 60 characters or less' })
  category: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Expense title is required' })
  @MaxLength(120, { message: 'Expense title must be 120 characters or less' })
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(AMOUNT_PATTERN, { message: AMOUNT_MESSAGE })
  @MaxLength(13, { message: 'Amount is too large' })
  amount?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Expense category is required' })
  @MaxLength(60, { message: 'Category must be 60 characters or less' })
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
