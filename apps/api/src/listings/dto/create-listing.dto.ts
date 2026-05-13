import {
  ArrayMaxSize,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ListingStatus } from '@prisma/client';
import { ListingMediaDto } from './listing-media.dto';

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
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ListingMediaDto)
  media?: ListingMediaDto[];
}
