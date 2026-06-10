import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkCategoryImportRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  parentSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  listingExpiryDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  useParentQuestions?: boolean;

  @IsOptional()
  @IsObject()
  schemaDefinition?: Record<string, unknown>;
}

export class BulkUpsertCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkCategoryImportRowDto)
  rows!: BulkCategoryImportRowDto[];

  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;
}
