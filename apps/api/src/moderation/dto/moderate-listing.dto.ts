import { ModerationActionType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ModerateListingDto {
  @IsEnum(ModerationActionType)
  action!:
    | 'LISTING_APPROVED'
    | 'LISTING_REJECTED'
    | 'LISTING_REMOVED'
    | 'REPORT_DISMISSED'
    | 'REPORT_UNDER_REVIEW';

  @IsOptional()
  @IsUUID()
  reportId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
