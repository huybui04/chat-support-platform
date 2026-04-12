import { IsUUID } from 'class-validator';

export class TypingDto {
  @IsUUID()
  sessionId: string;
}
