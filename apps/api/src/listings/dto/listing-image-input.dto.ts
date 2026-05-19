import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class ListingImageInputDto {
  @ValidateIf((image: ListingImageInputDto) => !image.assetId)
  @IsString()
  @IsNotEmpty()
  url?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
