import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListingImageInputDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
