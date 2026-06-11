import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_LISTING_IMAGES } from '../../media/media.constants';
import { ListingImageInputDto } from './listing-image-input.dto';

export class BulkImportListingRowDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsEmail()
  sellerEmail?: string;

  @IsOptional()
  @IsString()
  sellerPhone?: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  location!: string;

  @IsString()
  categorySlug!: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LISTING_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => ListingImageInputDto)
  images?: ListingImageInputDto[];
}

export class BulkImportListingsDto {
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportListingRowDto)
  rows!: BulkImportListingRowDto[];
}
