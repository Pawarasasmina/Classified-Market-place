import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @MinLength(1)
  listingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  initialMessage?: string;
}
