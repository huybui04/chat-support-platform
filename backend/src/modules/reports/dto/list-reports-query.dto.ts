import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum ReportsTimeWindow {
  LAST_24_HOURS = '24h',
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  ALL = 'all',
}

export class ListReportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReportsTimeWindow)
  window?: ReportsTimeWindow = ReportsTimeWindow.ALL;
}
