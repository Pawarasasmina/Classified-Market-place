import { IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyPhoneDto {
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsString()
  @Length(4, 8)
  otpCode!: string;
}
