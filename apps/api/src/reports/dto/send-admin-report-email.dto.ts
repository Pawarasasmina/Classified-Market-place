import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum AdminReportEmailType {
  MONITORING = 'monitoring',
  ACTIVE_LISTINGS = 'active-listings',
  PAID_LISTINGS = 'paid-listings',
  CATEGORY_INCOME = 'category-income',
  BOOST_REVENUE = 'boost-revenue',
  WALLET_PAYMENTS = 'wallet-payments',
  SELLERS = 'sellers',
  TOP_SELLERS = 'top-sellers',
  APPROVALS = 'approvals',
  SELLER_APPROVALS = 'seller-approvals',
}

export class AdminReportEmailParamsDto {
  @IsEnum(AdminReportEmailType)
  reportType!: AdminReportEmailType;
}

export class AdminReportEmailFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topTake?: number;
}

export class SendAdminReportEmailDto {
  @Transform(({ value }) => normalizeEmailList(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  recipients!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(140)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminReportEmailFiltersDto)
  filters?: AdminReportEmailFiltersDto;
}

function normalizeEmailList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        typeof item === 'string' ? item.split(',') : String(item),
      )
      .map((email) => email.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
  }

  return value;
}
