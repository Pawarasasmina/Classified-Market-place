import { IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;
}
