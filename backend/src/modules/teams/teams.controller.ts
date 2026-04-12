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

import { Roles } from '../../common/decorators/roles.decorator';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@Roles(UserRole.SUPERVISOR)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async findAll(@Query() query: ListTeamsQueryDto) {
    const result = await this.teamsService.findAll(query);
    return apiSuccess(result.items, result.meta);
  }

  @Post()
  async create(@Body() payload: CreateTeamDto) {
    const team = await this.teamsService.create(payload);
    return apiSuccess(team);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() payload: UpdateTeamDto) {
    const team = await this.teamsService.update(id, payload);
    return apiSuccess(team);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.teamsService.remove(id);
    return apiSuccess({ id });
  }

  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() payload: AddTeamMemberDto) {
    const member = await this.teamsService.addMember(id, payload);
    return apiSuccess(member);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    await this.teamsService.removeMember(id, userId);
    return apiSuccess({ id, userId });
  }
}
