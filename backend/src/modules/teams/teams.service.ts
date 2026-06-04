import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Team, TeamMember, User, UserRole } from '../../database/entities';
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

  async findAll(query: ListTeamsQueryDto, tenantId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.teamsRepository
      .createQueryBuilder('team')
      .where('team.tenantId = :tenantId', { tenantId })
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

  async findById(id: string, tenantId: string): Promise<Team> {
    const team = await this.teamsRepository.findOne({ where: { id, tenantId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  async create(payload: CreateTeamDto, tenantId: string): Promise<Team> {
    const team = this.teamsRepository.create({
      name: payload.name,
      description: payload.description ?? null,
      createdById: payload.createdById,
      tenantId,
    });

    return this.teamsRepository.save(team);
  }

  async update(id: string, payload: UpdateTeamDto, tenantId: string): Promise<Team> {
    const team = await this.findById(id, tenantId);

    const merged = this.teamsRepository.merge(team, {
      ...payload,
      description:
        payload.description !== undefined
          ? payload.description
          : team.description,
    });

    return this.teamsRepository.save(merged);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const team = await this.findById(id, tenantId);
    await this.teamsRepository.remove(team);
  }

  async addMember(
    teamId: string,
    payload: AddTeamMemberDto,
    tenantId: string,
  ): Promise<TeamMember> {
    await this.findById(teamId, tenantId);

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

  async listMembers(teamId: string, tenantId: string): Promise<TeamMember[]> {
    await this.findById(teamId, tenantId);

    return this.teamMembersRepository.find({
      where: { teamId },
      relations: { user: true },
      order: { joinedAt: 'DESC' },
    });
  }

  async listMembersForUser(userId: string): Promise<User[]> {
    const ownMemberships = await this.teamMembersRepository.find({
      where: { userId },
      select: { teamId: true },
    });

    const teamIds = Array.from(
      new Set(ownMemberships.map((item) => item.teamId)),
    );
    if (teamIds.length === 0) {
      return [];
    }

    const members = await this.teamMembersRepository.find({
      where: { teamId: In(teamIds) },
      relations: { user: true },
      order: { joinedAt: 'DESC' },
    });

    const deduped = new Map<string, User>();

    for (const member of members) {
      if (!member.user || member.user.role !== UserRole.AGENT) {
        continue;
      }

      if (!deduped.has(member.user.id)) {
        deduped.set(member.user.id, member.user);
      }
    }

    return Array.from(deduped.values());
  }

  async removeMember(teamId: string, userId: string, tenantId: string): Promise<void> {
    await this.findById(teamId, tenantId);

    const member = await this.teamMembersRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    await this.teamMembersRepository.remove(member);
  }
}
