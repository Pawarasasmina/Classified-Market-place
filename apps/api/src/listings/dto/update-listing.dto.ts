import { ListingStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ListingMediaDto } from './listing-media.dto';

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ListingMediaDto)
  media?: ListingMediaDto[];
}
