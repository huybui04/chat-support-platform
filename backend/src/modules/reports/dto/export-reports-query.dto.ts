import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { ListReportsQueryDto } from './list-reports-query.dto';

export enum ReportsExportKind {
  CAMPAIGNS = 'campaigns',
  AGENTS = 'agents',
  SESSIONS = 'sessions',
  CAMPAIGN_DETAIL = 'campaign-detail',
}

export enum ReportsExportFormat {
  CSV = 'csv',
  JSON = 'json',
}

export class ExportReportsQueryDto extends ListReportsQueryDto {
  @IsEnum(ReportsExportKind)
  kind: ReportsExportKind;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  all?: boolean = false;

  @IsOptional()
  @IsEnum(ReportsExportFormat)
  format?: ReportsExportFormat = ReportsExportFormat.CSV;
}
