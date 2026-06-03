import { BoostPlacement } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateBoostDto {
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsIn(['GATEWAY', 'WALLET'])
  paymentMethod?: 'GATEWAY' | 'WALLET';

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
