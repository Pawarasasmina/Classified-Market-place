import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SellerReviewStatus } from '@prisma/client';

export class ModerateSellerReviewDto {
  @IsEnum(SellerReviewStatus)
  status!: SellerReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
