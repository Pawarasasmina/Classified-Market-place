import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateConversationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsBoolean()
  muted?: boolean;
}
