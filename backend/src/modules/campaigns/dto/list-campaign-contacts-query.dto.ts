import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CampaignContactStatus } from '../../../database/entities';

export class ListCampaignContactsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CampaignContactStatus)
  status?: CampaignContactStatus;
}
