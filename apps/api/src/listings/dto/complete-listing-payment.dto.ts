import { IsOptional, IsString } from 'class-validator';

export class CompleteListingPaymentDto {
  @IsOptional()
  @IsString()
  providerRef?: string;
}
