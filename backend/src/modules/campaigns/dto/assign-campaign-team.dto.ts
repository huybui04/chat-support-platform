import { IsUUID } from 'class-validator';

export class AssignCampaignTeamDto {
  @IsUUID()
  teamId: string;
}
