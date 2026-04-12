import { IsOptional, IsUUID } from 'class-validator';

export class AcceptSessionDto {
  @IsOptional()
  @IsUUID()
  agentId?: string;
}
