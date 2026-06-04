import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../../common/auth/auth-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { UsersService } from '../users/users.service';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@Roles(UserRole.SUPERVISOR)
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me/members')
  @Roles(UserRole.AGENT, UserRole.SUPERVISOR)
  async myTeamMembers(@CurrentUser() user: AuthUser) {
    const currentUser = await this.usersService.ensureFromAuthUser(user);
    const items = await this.teamsService.listMembersForUser(currentUser.id);
    return apiSuccess(items);
  }

  @Get()
  async findAll(
    @Query() query: ListTeamsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.teamsService.findAll(query, user.tenantId || 'chat-support-platform');
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const team = await this.teamsService.findById(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(team);
  }

  @Get(':id/members')
  async listMembers(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const items = await this.teamsService.listMembers(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(items);
  }

  @Post()
  async create(
    @Body() payload: CreateTeamDto,
    @CurrentUser() user: AuthUser,
  ) {
    const team = await this.teamsService.create(payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(team);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateTeamDto,
    @CurrentUser() user: AuthUser,
  ) {
    const team = await this.teamsService.update(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(team);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.teamsService.remove(id, user.tenantId || 'chat-support-platform');
    return apiSuccess({ id });
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body() payload: AddTeamMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    const member = await this.teamsService.addMember(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(member);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.teamsService.removeMember(id, userId, user.tenantId || 'chat-support-platform');
    return apiSuccess({ id, userId });
  }
}
