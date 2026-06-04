import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { AuthUser } from '../../common/auth/auth-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { AssignCampaignAgentDto } from './dto/assign-campaign-agent.dto';
import { AssignCampaignTeamDto } from './dto/assign-campaign-team.dto';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ImportCampaignContactsDto } from './dto/import-campaign-contacts.dto';
import { ListCampaignContactsQueryDto } from './dto/list-campaign-contacts-query.dto';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';

@Controller('campaigns')
@Roles(UserRole.SUPERVISOR)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async findAll(
    @Query() query: ListCampaignsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.campaignsService.findAll(query, user.tenantId || 'chat-support-platform');
    return apiSuccess(result.items, result.meta);
  }

  @Get('me')
  @Roles(UserRole.AGENT, UserRole.SUPERVISOR)
  async myCampaigns(@CurrentUser() user: AuthUser) {
    const items = await this.campaignsService.listMyActiveCampaigns(user);
    return apiSuccess(items);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const campaign = await this.campaignsService.findById(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(campaign);
  }

  @Post()
  async create(
    @Body() payload: CreateCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    const campaign = await this.campaignsService.create(payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(campaign);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    const campaign = await this.campaignsService.update(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(campaign);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.campaignsService.remove(id, user.tenantId || 'chat-support-platform');
    return apiSuccess({ id });
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() payload: UpdateCampaignStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const campaign = await this.campaignsService.updateStatus(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(campaign);
  }

  @Post(':id/agents')
  async assignAgent(
    @Param('id') id: string,
    @Body() payload: AssignCampaignAgentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const assignment = await this.campaignsService.assignAgent(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(assignment);
  }

  @Get(':id/agents')
  async listAgents(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const items = await this.campaignsService.listAgents(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(items);
  }

  @Delete(':id/agents/:agentId')
  async removeAgent(
    @Param('id') id: string,
    @Param('agentId') agentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.campaignsService.removeAgent(id, agentId, user.tenantId || 'chat-support-platform');
    return apiSuccess({ id, agentId });
  }

  @Post(':id/teams')
  async assignTeam(
    @Param('id') id: string,
    @Body() payload: AssignCampaignTeamDto,
    @CurrentUser() user: AuthUser,
  ) {
    const assignment = await this.campaignsService.assignTeam(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(assignment);
  }

  @Get(':id/teams')
  async listTeams(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const items = await this.campaignsService.listTeams(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(items);
  }

  @Delete(':id/teams/:teamId')
  async removeTeam(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.campaignsService.removeTeam(id, teamId, user.tenantId || 'chat-support-platform');
    return apiSuccess({ id, teamId });
  }

  @Get(':id/stats')
  async stats(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const stats = await this.campaignsService.getStats(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(stats);
  }

  @Get(':id/contacts')
  async listContacts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCampaignContactsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.campaignsService.listCampaignContacts(id, query, user.tenantId || 'chat-support-platform');
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id/contacts/import-logs')
  async listImportLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCampaignContactsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.campaignsService.listCampaignImportLogs(
      id,
      query,
      user.tenantId || 'chat-support-platform',
    );
    return apiSuccess(result.items, result.meta);
  }

  @Post(':id/contacts/import')
  @UseInterceptors(FileInterceptor('file'))
  async importContacts(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() payload: ImportCampaignContactsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.campaignsService.importCampaignContacts(
      id,
      file,
      payload,
      user.sub,
      user.tenantId || 'chat-support-platform',
    );
    return apiSuccess(result);
  }
}
