import { BoostPlacement, BoostStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class QueryBoostsDto {
  @IsOptional()
  @IsEnum(BoostStatus)
  status?: BoostStatus;

  @IsOptional()
  @IsEnum(BoostPlacement)
  placement?: BoostPlacement;

  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsUUID()
  purchaserId?: string;
}
