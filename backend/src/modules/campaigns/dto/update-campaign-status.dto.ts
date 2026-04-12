import { IsEnum } from 'class-validator';

import { CampaignStatus } from '../../../database/entities';

export class UpdateCampaignStatusDto {
  @IsEnum(CampaignStatus)
  status: CampaignStatus;
}
