import { Controller, Get, Param, Query } from '@nestjs/common';
import { Res } from '@nestjs/common';
import type { Response } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { ExportReportsQueryDto } from './dto/export-reports-query.dto';
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
  async exportCsv(
    @Query() query: ExportReportsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.reportsService.buildCsvExport(query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return result.csv;
  }
}
