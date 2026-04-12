import { IsUUID } from 'class-validator';

export class JoinSessionDto {
  @IsUUID()
  sessionId: string;
}
