import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordListingViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
