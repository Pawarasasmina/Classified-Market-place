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

export class CreatePriorityRuleDto {
  @IsString()
  name!: string;

  @IsEnum(ListingPriorityRuleTarget)
  target!: ListingPriorityRuleTarget;

  @ValidateIf(
    (dto: CreatePriorityRuleDto) =>
      dto.target === ListingPriorityRuleTarget.BOOST_PACKAGE,
  )
  @IsString()
  boostPackageId?: string;

  @ValidateIf(
    (dto: CreatePriorityRuleDto) =>
      dto.target === ListingPriorityRuleTarget.CATEGORY_PRIORITY,
  )
  @IsString()
  categoryId?: string;

  @IsInt()
  @Min(0)
  @Max(10000)
  weight!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
