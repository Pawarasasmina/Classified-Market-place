import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateListingPriorityOverrideDto {
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsBoolean()
  promoted?: boolean;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  score?: number | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;
}
