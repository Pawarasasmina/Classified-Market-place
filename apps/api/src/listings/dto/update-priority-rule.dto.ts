import { ListingPriorityRuleTarget } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdatePriorityRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ListingPriorityRuleTarget)
  target?: ListingPriorityRuleTarget;

  @IsOptional()
  @ValidateIf((dto: UpdatePriorityRuleDto) => dto.boostPackageId !== undefined)
  @IsString()
  boostPackageId?: string;

  @IsOptional()
  @ValidateIf((dto: UpdatePriorityRuleDto) => dto.categoryId !== undefined)
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
