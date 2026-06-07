import { IsOptional, IsUUID } from 'class-validator';

export class UploadListingImageDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;
}
