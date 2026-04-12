import { IsUUID } from 'class-validator';

export class AssignCampaignAgentDto {
  @IsUUID()
  agentId: string;
}
