import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { MessageType } from '../../../database/entities';

export class SendMessageDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;
}
