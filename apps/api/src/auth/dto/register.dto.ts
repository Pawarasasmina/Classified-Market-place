import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsIn(['CUSTOMER', 'SELLER'])
  accountType?: 'CUSTOMER' | 'SELLER';

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  confirmPassword?: string;

  @IsOptional()
  @IsObject()
  sellerFormAnswers?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sellerRequestMetadata?: Record<string, unknown>;

  @IsBoolean()
  termsAccepted!: boolean;
}
