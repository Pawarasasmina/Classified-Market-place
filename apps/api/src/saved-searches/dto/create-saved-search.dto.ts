import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const allowedSortValues = ['newest', 'price_asc', 'price_desc'] as const;

export class CreateSavedSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @IsIn(allowedSortValues)
  sort?: 'newest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;
}
