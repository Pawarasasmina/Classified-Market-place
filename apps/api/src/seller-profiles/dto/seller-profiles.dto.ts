import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const sellerFieldTypes = ['text', 'textarea', 'select', 'toggle', 'file'] as const;

export class UpdateSellerProfileDto {
  @IsOptional()
  @IsObject()
  formAnswers?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  requestMetadata?: Record<string, unknown>;
}

export class SubmitSellerProfileDto extends UpdateSellerProfileDto {}

export class SellerDocumentSubmissionDto {
  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  files?: Array<Record<string, unknown>>;
}

export class ReviewSellerProfileDto {
  @IsIn(['APPROVED', 'REJECTED', 'SUSPENDED'])
  status!: 'APPROVED' | 'REJECTED' | 'SUSPENDED';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  privilegeTierId?: string;

  @IsOptional()
  @IsObject()
  reviewMetadata?: Record<string, unknown>;
}

export class CreateSellerDocumentRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsObject()
  formDefinition?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class ReviewSellerDocumentDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rejectionReason?: string;

  @IsOptional()
  @IsObject()
  reviewMetadata?: Record<string, unknown>;
}

export class UpdateSellerFormDefinitionDto {
  @IsObject()
  schemaDefinition!: Record<string, unknown>;
}

export class RequestVerifiedSellerDto {
  @IsOptional()
  @IsObject()
  requestMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reviewNotes?: string;
}

export class ReviewVerifiedSellerDto {
  @IsIn(['VERIFIED', 'REJECTED', 'NOT_REQUESTED'])
  status!: 'VERIFIED' | 'REJECTED' | 'NOT_REQUESTED';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reviewNotes?: string;

  @IsOptional()
  @IsObject()
  reviewMetadata?: Record<string, unknown>;
}

export class UpsertSellerPrivilegeTierDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsIn(['FREE', 'PREMIUM', 'VERIFIED', 'VIP'])
  code!: 'FREE' | 'PREMIUM' | 'VERIFIED' | 'VIP';

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyFreeListingLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeListingLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  pendingListingLimit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidListingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellerLevelUpgradeFee?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class UpsertSellerPrivilegeQuotaDto {
  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyFreeListingLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeListingLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  pendingListingLimit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidListingFee?: number | null;
}

export class UpgradeSellerPrivilegeDto {
  @IsString()
  sellerPrivilegeTierId!: string;
}

export class UpsertSellerBadgeTypeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  icon?: string;

  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  textColor?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class AssignSellerBadgeDto {
  @IsString()
  badgeTypeId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class QuerySellerProfilesDto {
  @IsOptional()
  @IsIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'])
  status?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

  @IsOptional()
  @IsIn(['NOT_REQUESTED', 'REQUESTED', 'VERIFIED', 'REJECTED'])
  verifiedStatus?: 'NOT_REQUESTED' | 'REQUESTED' | 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

export type SellerFieldType = (typeof sellerFieldTypes)[number];
