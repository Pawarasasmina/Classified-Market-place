import { BoostPlacement } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateBoostDto {
  @IsOptional()
  @IsEnum(BoostPlacement)
  placement?: BoostPlacement;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  durationDays?: number;
}
