import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
import { FindOptionsWhere, Repository } from 'typeorm';

import type { AuthUser } from '../../common/auth/auth-user.type';
import {
  Campaign,
  CampaignAgent,
  CampaignContact,
  CampaignContactStatus,
  CampaignTeam,
  CampaignStatus,
  ChatSession,
  ChatSessionStatus,
  Contact,
  CsvImportLog,
  CsvImportStatus,
  Team,
  User,
  UserRole,
} from '../../database/entities';
import { AssignCampaignAgentDto } from './dto/assign-campaign-agent.dto';
import { AssignCampaignTeamDto } from './dto/assign-campaign-team.dto';
import { CampaignStatsDto } from './dto/campaign-stats.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ImportCampaignContactsDto } from './dto/import-campaign-contacts.dto';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto';
import { ListCampaignContactsQueryDto } from './dto/list-campaign-contacts-query.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(CampaignAgent)
    private readonly campaignAgentsRepository: Repository<CampaignAgent>,
    @InjectRepository(CampaignTeam)
    private readonly campaignTeamsRepository: Repository<CampaignTeam>,
    @InjectRepository(CampaignContact)
    private readonly campaignContactsRepository: Repository<CampaignContact>,
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
    @InjectRepository(CsvImportLog)
    private readonly csvImportLogsRepository: Repository<CsvImportLog>,
  ) {}

  async findAll(query: ListCampaignsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: FindOptionsWhere<Campaign> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.createdById) {
      where.createdById = query.createdById;
    }

    const [items, total] = await this.campaignsRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async listMyActiveCampaigns(currentUser: AuthUser): Promise<Campaign[]> {
    const currentAgent = await this.usersRepository.findOne({
      where: { keycloakId: currentUser.sub },
      select: { id: true },
    });

    if (!currentAgent) {
      throw new NotFoundException('User not found');
    }

    const today = new Date().toISOString().slice(0, 10);

    return this.campaignsRepository
      .createQueryBuilder('campaign')
      .where('campaign.status = :status', { status: CampaignStatus.ACTIVE })
      .andWhere('(campaign.startDate IS NULL OR campaign.startDate <= :today)', {
        today,
      })
      .andWhere('(campaign.endDate IS NULL OR campaign.endDate >= :today)', {
        today,
      })
      .andWhere(
        `(
          campaign.id IN (
            SELECT ca.campaign_id
            FROM campaign_agents ca
            WHERE ca.agent_id = :currentAgentUserId
          )
          OR campaign.id IN (
            SELECT ct.campaign_id
            FROM campaign_teams ct
            INNER JOIN team_members tm ON tm.team_id = ct.team_id
            WHERE tm.user_id = :currentAgentUserId
          )
        )`,
        { currentAgentUserId: currentAgent.id },
      )
      .orderBy('campaign.createdAt', 'DESC')
      .getMany();
  }

  async findById(id: string): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async create(payload: CreateCampaignDto): Promise<Campaign> {
    const campaign = this.campaignsRepository.create({
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status,
      channel: payload.channel,
      type: payload.type,
      startDate: payload.startDate ?? null,
      endDate: payload.endDate ?? null,
      createdById: payload.createdById,
    });

    return this.campaignsRepository.save(campaign);
  }

  async update(id: string, payload: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findById(id);

    const merged = this.campaignsRepository.merge(campaign, {
      ...payload,
      description:
        payload.description !== undefined
          ? payload.description
          : campaign.description,
      startDate:
        payload.startDate !== undefined
          ? payload.startDate
          : campaign.startDate,
      endDate:
        payload.endDate !== undefined ? payload.endDate : campaign.endDate,
    });

    return this.campaignsRepository.save(merged);
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.findById(id);
    await this.campaignsRepository.remove(campaign);
  }

  async updateStatus(
    id: string,
    payload: UpdateCampaignStatusDto,
  ): Promise<Campaign> {
    const campaign = await this.findById(id);
    campaign.status = payload.status;

    return this.campaignsRepository.save(campaign);
  }

  async assignAgent(
    id: string,
    payload: AssignCampaignAgentDto,
  ): Promise<CampaignAgent> {
    await this.findById(id);

    const agent = await this.usersRepository.findOne({
      where: { id: payload.agentId },
    });
    if (!agent || agent.role !== UserRole.AGENT) {
      throw new NotFoundException('Agent not found');
    }

    const existing = await this.campaignAgentsRepository.findOne({
      where: { campaignId: id, agentId: payload.agentId },
    });

    if (existing) {
      return existing;
    }

    const assignment = this.campaignAgentsRepository.create({
      campaignId: id,
      agentId: payload.agentId,
    });

    return this.campaignAgentsRepository.save(assignment);
  }

  async listAgents(id: string): Promise<CampaignAgent[]> {
    await this.findById(id);

    return this.campaignAgentsRepository.find({
      where: { campaignId: id },
      relations: { agent: true },
      order: { assignedAt: 'DESC' },
    });
  }

  async removeAgent(id: string, agentId: string): Promise<void> {
    await this.findById(id);

    const assignment = await this.campaignAgentsRepository.findOne({
      where: { campaignId: id, agentId },
    });

    if (!assignment) {
      throw new NotFoundException('Campaign agent assignment not found');
    }

    await this.campaignAgentsRepository.remove(assignment);
  }

  async assignTeam(
    id: string,
    payload: AssignCampaignTeamDto,
  ): Promise<CampaignTeam> {
    await this.findById(id);

    const team = await this.teamsRepository.findOne({
      where: { id: payload.teamId },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const existing = await this.campaignTeamsRepository.findOne({
      where: { campaignId: id, teamId: payload.teamId },
    });

    if (existing) {
      return existing;
    }

    const assignment = this.campaignTeamsRepository.create({
      campaignId: id,
      teamId: payload.teamId,
    });

    return this.campaignTeamsRepository.save(assignment);
  }

  async listTeams(id: string): Promise<CampaignTeam[]> {
    await this.findById(id);

    return this.campaignTeamsRepository.find({
      where: { campaignId: id },
      relations: { team: true },
      order: { id: 'DESC' },
    });
  }

  async removeTeam(id: string, teamId: string): Promise<void> {
    await this.findById(id);

    const assignment = await this.campaignTeamsRepository.findOne({
      where: { campaignId: id, teamId },
    });

    if (!assignment) {
      throw new NotFoundException('Campaign team assignment not found');
    }

    await this.campaignTeamsRepository.remove(assignment);
  }

  async getStats(id: string): Promise<CampaignStatsDto> {
    const campaign = await this.findById(id);

    const totalContacts = await this.campaignContactsRepository.count({
      where: { campaignId: id },
    });

    const sessionCountsRaw = await this.sessionsRepository
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.campaignId = :campaignId', { campaignId: id })
      .groupBy('s.status')
      .getRawMany<{ status: ChatSessionStatus; count: string }>();

    const sessions = {
      pending: 0,
      active: 0,
      completed: 0,
      abandoned: 0,
    };

    for (const row of sessionCountsRaw) {
      const count = Number(row.count);
      if (row.status === ChatSessionStatus.PENDING) {
        sessions.pending = count;
      }
      if (row.status === ChatSessionStatus.ACTIVE) {
        sessions.active = count;
      }
      if (row.status === ChatSessionStatus.COMPLETED) {
        sessions.completed = count;
      }
      if (row.status === ChatSessionStatus.ABANDONED) {
        sessions.abandoned = count;
      }
    }

    const durationRaw = await this.sessionsRepository
      .createQueryBuilder('s')
      .select(
        'AVG(EXTRACT(EPOCH FROM (s.endedAt - s.startedAt)))',
        'avgDuration',
      )
      .where('s.campaignId = :campaignId', { campaignId: id })
      .andWhere('s.startedAt IS NOT NULL')
      .andWhere('s.endedAt IS NOT NULL')
      .getRawOne<{ avgDuration: string | null }>();

    return {
      campaignId: campaign.id,
      name: campaign.name,
      totalContacts,
      sessions,
      avgResponseTimeSeconds: 0,
      avgSessionDurationSeconds: Number(durationRaw?.avgDuration ?? 0),
    };
  }

  async listCampaignContacts(id: string, query: ListCampaignContactsQueryDto) {
    await this.findById(id);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.campaignContactsRepository
      .createQueryBuilder('cc')
      .leftJoinAndSelect('cc.contact', 'contact')
      .where('cc.campaignId = :campaignId', { campaignId: id })
      .orderBy('cc.assignedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('cc.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('cc.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async listCampaignImportLogs(
    id: string,
    query: ListCampaignContactsQueryDto,
  ) {
    await this.findById(id);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.csvImportLogsRepository.findAndCount({
      where: { campaignId: id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async importCampaignContacts(
    id: string,
    file: Express.Multer.File,
    payload: ImportCampaignContactsDto,
    importedById: string,
  ) {
    await this.findById(id);

    const log = this.csvImportLogsRepository.create({
      campaignId: id,
      fileName: file.originalname,
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      status: CsvImportStatus.PROCESSING,
      errorLog: null,
      importedById,
    });

    const createdLog = await this.csvImportLogsRepository.save(log);

    let totalRows = 0;
    let successRows = 0;
    let failedRows = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    try {
      const csvText = file.buffer.toString('utf-8');
      const records = this.parseCsvRows(csvText);

      if (records.length === 0) {
        throw new Error('CSV file has no data rows');
      }

      const mapping = payload.mapping ?? {
        full_name: 'full_name',
        phone: 'phone',
        email: 'email',
      };

      const fullNameColumn = mapping.full_name ?? 'full_name';
      const phoneColumn = mapping.phone ?? 'phone';
      const emailColumn = mapping.email ?? 'email';

      if (!(fullNameColumn in records[0])) {
        throw new Error('CSV missing required full_name column mapping');
      }

      const seenFileKeys = new Set<string>();

      for (let rowIndex = 0; rowIndex < records.length; rowIndex += 1) {
        totalRows += 1;
        const record = records[rowIndex];

        const fullName = this.normalizeCell(record[fullNameColumn]);
        const phone = this.normalizePhone(record[phoneColumn]);
        const email = this.normalizeEmail(record[emailColumn]);

        if (!fullName) {
          failedRows += 1;
          errors.push({ row: rowIndex + 2, reason: 'full_name is required' });
          continue;
        }

        if (!phone && !email) {
          failedRows += 1;
          errors.push({
            row: rowIndex + 2,
            reason: 'phone or email is required',
          });
          continue;
        }

        const dedupeKey = email ? `email:${email}` : `phone:${phone}`;
        if (seenFileKeys.has(dedupeKey)) {
          failedRows += 1;
          errors.push({
            row: rowIndex + 2,
            reason: 'duplicate contact in the same import file',
          });
          continue;
        }
        seenFileKeys.add(dedupeKey);

        const existsInCampaign = await this.contactExistsInCampaign(
          id,
          email,
          phone,
        );
        if (existsInCampaign) {
          failedRows += 1;
          errors.push({
            row: rowIndex + 2,
            reason: 'contact already exists in campaign',
          });
          continue;
        }

        const metadata = this.extractMetadata(record, [
          fullNameColumn,
          phoneColumn,
          emailColumn,
        ]);

        const contact = this.contactsRepository.create({
          fullName,
          phone,
          email,
          whatsappId: null,
          metadata,
        });
        const savedContact = await this.contactsRepository.save(contact);

        const campaignContact = this.campaignContactsRepository.create({
          campaignId: id,
          contactId: savedContact.id,
          status: CampaignContactStatus.PENDING,
          importBatch: createdLog.id,
        });

        await this.campaignContactsRepository.save(campaignContact);
        successRows += 1;
      }

      createdLog.totalRows = totalRows;
      createdLog.successRows = successRows;
      createdLog.failedRows = failedRows;
      createdLog.status = CsvImportStatus.COMPLETED;
      createdLog.errorLog = errors.length > 0 ? { errors } : null;
      const savedLog = await this.csvImportLogsRepository.save(createdLog);

      return {
        log: savedLog,
        summary: { totalRows, successRows, failedRows },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import failed';
      createdLog.totalRows = totalRows;
      createdLog.successRows = successRows;
      createdLog.failedRows = failedRows;
      createdLog.status = CsvImportStatus.FAILED;
      createdLog.errorLog = { message, errors };
      const savedLog = await this.csvImportLogsRepository.save(createdLog);

      return {
        log: savedLog,
        summary: { totalRows, successRows, failedRows },
      };
    }
  }

  private parseCsvRows(csvText: string): Array<Record<string, string>> {
    const parsed = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }
    const parsedRows = parsed as unknown[];

    const rows: Array<Record<string, string>> = [];
    for (const item of parsedRows) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      const row: Record<string, string> = {};
      for (const [key, value] of Object.entries(item)) {
        const normalizedKey = key.trim();
        row[normalizedKey] = this.normalizeCell(value);
      }
      rows.push(row);
    }

    return rows;
  }

  private normalizeCell(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  private normalizeEmail(value: unknown): string | null {
    const normalized = this.normalizeCell(value).toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizePhone(value: unknown): string | null {
    const normalized = this.normalizeCell(value);
    return normalized.length > 0 ? normalized : null;
  }

  private extractMetadata(
    row: Record<string, string>,
    excludedColumns: string[],
  ): Record<string, unknown> | null {
    const excluded = new Set(excludedColumns.map((column) => column.trim()));
    const metadata: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (!excluded.has(key) && value.length > 0) {
        metadata[key] = value;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  private async contactExistsInCampaign(
    campaignId: string,
    email: string | null,
    phone: string | null,
  ): Promise<boolean> {
    if (!email && !phone) {
      return false;
    }

    const qb = this.campaignContactsRepository
      .createQueryBuilder('cc')
      .innerJoin('cc.contact', 'contact')
      .where('cc.campaignId = :campaignId', { campaignId });

    if (email && phone) {
      qb.andWhere('(LOWER(contact.email) = :email OR contact.phone = :phone)', {
        email,
        phone,
      });
    } else if (email) {
      qb.andWhere('LOWER(contact.email) = :email', { email });
    } else if (phone) {
      qb.andWhere('contact.phone = :phone', { phone });
    }

    const existing = await qb.select('cc.id').getOne();
    return Boolean(existing);
  }
}
