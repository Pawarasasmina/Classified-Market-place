import { IsEmail, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  idToken?: string;

  @IsOptional()
  @IsString()
  googleId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;
}
