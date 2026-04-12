import { IsUUID } from 'class-validator';

export class EndSessionDto {
  @IsUUID()
  sessionId: string;
}
