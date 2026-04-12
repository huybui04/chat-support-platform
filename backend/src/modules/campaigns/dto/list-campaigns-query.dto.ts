import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { CampaignChannel, CampaignStatus } from '../../../database/entities';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListCampaignsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @IsOptional()
  @IsUUID()
  createdById?: string;
}
