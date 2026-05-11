import { MessageType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @IsEnum(MessageType)
  type!: MessageType;

  @ValidateIf((body: SendMessageDto) => body.type === MessageType.TEXT)
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  listingId?: string;

  @ValidateIf((body: SendMessageDto) => body.type === MessageType.OFFER)
  @IsNumber()
  offerAmount?: number;

  @ValidateIf((body: SendMessageDto) => body.type === MessageType.OFFER)
  @IsString()
  offerCurrency?: string;
}
