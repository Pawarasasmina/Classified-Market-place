import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateListingReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
