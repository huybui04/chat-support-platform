import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Team, TeamMember } from '../../database/entities';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMembersRepository: Repository<TeamMember>,
  ) {}

  async findAll(query: ListTeamsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.teamsRepository
      .createQueryBuilder('team')
      .orderBy('team.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.createdById) {
      qb.andWhere('team.createdById = :createdById', {
        createdById: query.createdById,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async findById(id: string): Promise<Team> {
    const team = await this.teamsRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  async create(payload: CreateTeamDto): Promise<Team> {
    const team = this.teamsRepository.create({
      name: payload.name,
      description: payload.description ?? null,
      createdById: payload.createdById,
    });

    return this.teamsRepository.save(team);
  }

  async update(id: string, payload: UpdateTeamDto): Promise<Team> {
    const team = await this.findById(id);

    const merged = this.teamsRepository.merge(team, {
      ...payload,
      description:
        payload.description !== undefined
          ? payload.description
          : team.description,
    });

    return this.teamsRepository.save(merged);
  }

  async remove(id: string): Promise<void> {
    const team = await this.findById(id);
    await this.teamsRepository.remove(team);
  }

  async addMember(
    teamId: string,
    payload: AddTeamMemberDto,
  ): Promise<TeamMember> {
    await this.findById(teamId);

    const existing = await this.teamMembersRepository.findOne({
      where: { teamId, userId: payload.userId },
    });

    if (existing) {
      return existing;
    }

    const member = this.teamMembersRepository.create({
      teamId,
      userId: payload.userId,
    });

    return this.teamMembersRepository.save(member);
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await this.teamMembersRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    await this.teamMembersRepository.remove(member);
  }
}
