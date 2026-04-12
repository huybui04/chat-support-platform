import { Controller, Get, Param, Query } from '@nestjs/common';
import { Res } from '@nestjs/common';
import type { Response } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import {
  ExportReportsQueryDto,
  ReportsExportFormat,
  ReportsExportKind,
} from './dto/export-reports-query.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(UserRole.SUPERVISOR)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('campaigns')
  async campaigns(@Query() query: ListReportsQueryDto) {
    const result = await this.reportsService.getCampaignsOverview(query);
    return apiSuccess(result.items, result.meta);
  }

  @Get('campaigns/:id')
  async campaignDetail(
    @Param('id') id: string,
    @Query() query: ListReportsQueryDto,
  ) {
    const result = await this.reportsService.getCampaignDetail(id, query);
    return apiSuccess(result);
  }

  @Get('agents')
  async agents(@Query() query: ListReportsQueryDto) {
    const result = await this.reportsService.getAgentsReport(query);
    return apiSuccess(result.items, result.meta);
  }

  @Get('sessions')
  async sessions(@Query() query: ListReportsQueryDto) {
    const result = await this.reportsService.getSessionsReport(query);
    return apiSuccess(result);
  }

  @Get('export')
  async exportFile(
    @Query() query: ExportReportsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (query.format === ReportsExportFormat.JSON) {
      const result = await this.reportsService.buildJsonExport(query);
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      return result.json;
    }

    const canStreamAll =
      query.all &&
      (query.kind === ReportsExportKind.CAMPAIGNS ||
        query.kind === ReportsExportKind.AGENTS);

    if (canStreamAll) {
      const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
      const prefix =
        query.kind === ReportsExportKind.CAMPAIGNS
          ? 'campaign-overview'
          : 'agent-performance';

      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${prefix}-${timestamp}.csv"`,
      );

      const header =
        query.kind === ReportsExportKind.CAMPAIGNS
          ? this.reportsService.getCampaignExportHeader()
          : this.reportsService.getAgentsExportHeader();

      response.write(this.reportsService.toCsvLine(header));

      const rowIterator =
        query.kind === ReportsExportKind.CAMPAIGNS
          ? this.reportsService.iterateCampaignExportRows(query.window)
          : this.reportsService.iterateAgentExportRows(query.window);

      for await (const row of rowIterator) {
        response.write(this.reportsService.toCsvLine(row));
      }

      response.end();
      return;
    }

    const result = await this.reportsService.buildCsvExport(query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return result.csv;
  }
}
