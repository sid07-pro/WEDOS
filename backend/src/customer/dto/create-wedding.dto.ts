import { UpdateWeddingDto } from './update-wedding.dto';

/**
 * Creating a wedding accepts exactly the same required fields as a full update
 * (date, location, totalBudget), so the validation rules are inherited.
 */
export class CreateWeddingDto extends UpdateWeddingDto {}
