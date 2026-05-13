import { Type } from 'class-transformer';
import {
  IsBase64,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListingMediaDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @Matches(/^image\/(jpeg|png|webp)$/i, {
    message: 'Only JPEG, PNG, and WEBP images are supported.',
  })
  mimeType!: string;

  @IsBase64()
  base64Data!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_500_000)
  byteSize!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  height?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  sortOrder!: number;

  @Type(() => Boolean)
  @IsBoolean()
  isPrimary!: boolean;
}
