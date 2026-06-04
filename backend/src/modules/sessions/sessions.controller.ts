import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { AuthUser } from '../../common/auth/auth-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { AcceptSessionDto } from './dto/accept-session.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionMessagesQueryDto } from './dto/list-session-messages-query.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@Roles(UserRole.AGENT, UserRole.SUPERVISOR)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async findAll(
    @Query() query: ListSessionsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.sessionsService.findAll(query, user);
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const session = await this.sessionsService.findById(id, user.tenantId || 'chat-support-platform');
    const { campaign, contact, agent, ...base } = session;
    return apiSuccess({
      ...base,
      campaignName: campaign?.name ?? null,
      contactName: contact?.fullName ?? null,
      contactEmail: contact?.email ?? null,
      agentName: agent?.fullName ?? null,
      agentEmail: agent?.email ?? null,
    });
  }

  @Post()
  @Public()
  async create(@Body() payload: CreateSessionDto) {
    const session = await this.sessionsService.create(payload);
    return apiSuccess(session);
  }

  @Post(':id/accept')
  async accept(
    @Param('id') id: string,
    @Body() payload: AcceptSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const session = await this.sessionsService.accept(id, payload, user);
    return apiSuccess(session);
  }

  @Post(':id/end')
  async end(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const session = await this.sessionsService.end(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(session);
  }

  @Get(':id/messages')
  async listMessages(
    @Param('id') id: string,
    @Query() query: ListSessionMessagesQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.sessionsService.listMessages(id, query, user.tenantId || 'chat-support-platform');
    return apiSuccess(result.items, result.meta);
  }
}
