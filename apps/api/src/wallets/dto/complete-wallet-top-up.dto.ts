import { IsOptional, IsString } from 'class-validator';

export class CompleteWalletTopUpDto {
  @IsOptional()
  @IsString()
  providerRef?: string;
}
