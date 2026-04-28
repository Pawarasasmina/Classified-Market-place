import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
