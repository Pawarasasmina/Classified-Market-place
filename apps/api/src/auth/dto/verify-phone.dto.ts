import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyPhoneDto {
  @IsPhoneNumber()
  phone!: string;

  @IsString()
  @Length(4, 8)
  otpCode!: string;
}
