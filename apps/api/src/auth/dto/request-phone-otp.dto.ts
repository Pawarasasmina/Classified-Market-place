import { IsPhoneNumber } from 'class-validator';

export class RequestPhoneOtpDto {
  @IsPhoneNumber()
  phone!: string;
}
