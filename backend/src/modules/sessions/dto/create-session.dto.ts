import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { SessionChannel } from '../../../database/entities';

export class CreateSessionDto {
  @IsUUID()
  campaignId: string;

  @IsUUID()
  contactId: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsEnum(SessionChannel)
  channel: SessionChannel;
}
