import { ListingReportReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateListingReportDto {
  @IsEnum(ListingReportReason)
  reason!: ListingReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
