import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAdvertisementBannerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  kicker?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  body?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(1200)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  imageAlt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badgeLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  metricValue?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  metricLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ctaHref?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  secondaryCtaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  secondaryCtaHref?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  placement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  layout?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  backgroundColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  textColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  accentColor?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(30)
  rotationSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsISO8601()
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;
}
