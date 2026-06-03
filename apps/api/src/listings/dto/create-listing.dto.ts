import {
  IsEnum,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ListingPaymentMode, ListingStatus } from '@prisma/client';
import { MAX_LISTING_IMAGES } from '../../media/media.constants';
import { ListingImageInputDto } from './listing-image-input.dto';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsEnum(ListingPaymentMode)
  listingPaymentMode?: ListingPaymentMode;

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
