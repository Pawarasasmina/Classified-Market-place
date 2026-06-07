import { SellerPriorityTier } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { assignableUserRoles } from '../../common/admin-permissions';

const assignableRoleInputs = [
  ...assignableUserRoles,
  ...assignableUserRoles.map((role) => role.toLowerCase()),
];

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsIn(assignableRoleInputs)
  role?: string;

  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isPhoneVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  phoneVerified?: boolean;

  @IsOptional()
  @IsEnum(SellerPriorityTier)
  sellerPriorityTier?: SellerPriorityTier;
}
