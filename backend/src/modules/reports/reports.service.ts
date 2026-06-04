import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Campaign,
  CampaignChannel,
  CampaignContact,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  MessageSenderType,
  User,
  UserRole,
} from '../../database/entities';
import {
  ExportReportsQueryDto,
  ReportsExportFormat,
  ReportsExportKind,
} from './dto/export-reports-query.dto';
import {
  ListReportsQueryDto,
  ReportsTimeWindow,
} from './dto/list-reports-query.dto';

interface GroupedCount {
  key: string;
  count: string;
}

interface GroupedSessionCount {
  key: string;
  status: ChatSessionStatus;
  count: string;
}

const MAX_EXPORT_ROWS = 20000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(CampaignContact)
    private readonly campaignContactsRepository: Repository<CampaignContact>,
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getCampaignsOverview(query: ListReportsQueryDto, tenantId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const windowStartAt = this.getWindowStartDate(query.window);

    const campaignsQb = this.campaignsRepository
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.channel) {
      campaignsQb.andWhere('c.channel = :channel', { channel: query.channel });
    }

    if (windowStartAt) {
      campaignsQb.andWhere('c.createdAt >= :windowStartAt', { windowStartAt });
    }

    const [campaigns, total] = await campaignsQb.getManyAndCount();

    const campaignIds = campaigns.map((c) => c.id);
    if (campaignIds.length === 0) {
      return {
        items: [],
        meta: { page, limit, total },
      };
    }

    const contactsRaw = await this.campaignContactsRepository
      .createQueryBuilder('cc')
      .select('cc.campaignId', 'key')
      .addSelect('COUNT(*)', 'count')
      .where('cc.campaignId IN (:...campaignIds)', { campaignIds })
      .groupBy('cc.campaignId')
      .getRawMany<GroupedCount>();

    const sessionsQb = this.sessionsRepository
      .createQueryBuilder('s')
      .select('s.campaignId', 'key')
      .addSelect('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.campaignId IN (:...campaignIds)', { campaignIds })
      .andWhere('s.tenantId = :tenantId', { tenantId })
      .groupBy('s.campaignId')
      .addGroupBy('s.status');

    if (windowStartAt) {
      sessionsQb.andWhere('s.createdAt >= :windowStartAt', { windowStartAt });
    }

    const sessionsRaw = await sessionsQb.getRawMany<GroupedSessionCount>();

    const contactCountMap = new Map<string, number>();
    for (const row of contactsRaw) {
      contactCountMap.set(row.key, Number(row.count));
    }

    const sessionMap = new Map<
      string,
      { pending: number; active: number; completed: number; abandoned: number }
    >();

    for (const id of campaignIds) {
      sessionMap.set(id, {
        pending: 0,
        active: 0,
        completed: 0,
        abandoned: 0,
      });
    }

    for (const row of sessionsRaw) {
      const counts = sessionMap.get(row.key);
      if (!counts) continue;

      const count = Number(row.count);
      if (row.status === ChatSessionStatus.PENDING) counts.pending = count;
      if (row.status === ChatSessionStatus.ACTIVE) counts.active = count;
      if (row.status === ChatSessionStatus.COMPLETED) counts.completed = count;
      if (row.status === ChatSessionStatus.ABANDONED) counts.abandoned = count;
    }

    const items = campaigns.map((campaign) => ({
      campaignId: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      totalContacts: contactCountMap.get(campaign.id) ?? 0,
      sessions: sessionMap.get(campaign.id) ?? {
        pending: 0,
        active: 0,
        completed: 0,
        abandoned: 0,
      },
    }));

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async buildCsvExport(query: ExportReportsQueryDto, tenantId: string) {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');

    if (query.kind === ReportsExportKind.CAMPAIGNS) {
      const campaigns = query.all
        ? await this.getAllCampaignReports(query.window, query.channel, tenantId)
        : (
            await this.getCampaignsOverview({
              page: query.page,
              limit: query.limit,
              window: query.window,
              channel: query.channel,
            }, tenantId)
          ).items;

      const rows = [
        [
          'campaign_id',
          'campaign_name',
          'channel',
          'total_contacts',
          'pending_sessions',
          'active_sessions',
          'completed_sessions',
          'abandoned_sessions',
          'window',
        ],
        ...campaigns.map((campaign) => [
          campaign.campaignId,
          campaign.name,
          campaign.channel,
          String(campaign.totalContacts),
          String(campaign.sessions.pending),
          String(campaign.sessions.active),
          String(campaign.sessions.completed),
          String(campaign.sessions.abandoned),
          query.window ?? ReportsTimeWindow.ALL,
        ]),
      ];

      return {
        fileName: `campaign-overview-${timestamp}.csv`,
        csv: this.toCsv(rows),
      };
    }

    if (query.kind === ReportsExportKind.AGENTS) {
      const agents = query.all
        ? await this.getAllAgentReports(query.window, query.channel, tenantId)
        : (
            await this.getAgentsReport({
              page: query.page,
              limit: query.limit,
              window: query.window,
              channel: query.channel,
            }, tenantId)
          ).items;

      const rows = [
        [
          'agent_id',
          'full_name',
          'email',
          'handled_sessions',
          'completed_sessions',
          'avg_session_duration_seconds',
          'is_online',
          'channel_filter',
          'window',
        ],
        ...agents.map((agent) => [
          agent.agentId,
          agent.fullName,
          agent.email,
          String(agent.handledSessions),
          String(agent.completedSessions),
          String(Math.round(agent.avgSessionDurationSeconds ?? 0)),
          agent.isOnline ? 'online' : 'offline',
          query.channel ?? 'all',
          query.window ?? ReportsTimeWindow.ALL,
        ]),
      ];

      return {
        fileName: `agent-performance-${timestamp}.csv`,
        csv: this.toCsv(rows),
      };
    }

    if (query.kind === ReportsExportKind.SESSIONS) {
      const sessions = await this.getSessionsReport({
        window: query.window,
        channel: query.channel,
      }, tenantId);

      const rows = [
        [
          'total_sessions',
          'pending_sessions',
          'active_sessions',
          'completed_sessions',
          'abandoned_sessions',
          'avg_response_time_seconds',
          'avg_session_duration_seconds',
          'channel_filter',
          'window',
        ],
        [
          String(sessions.totalSessions),
          String(sessions.byStatus.pending),
          String(sessions.byStatus.active),
          String(sessions.byStatus.completed),
          String(sessions.byStatus.abandoned),
          String(Math.round(sessions.avgResponseTimeSeconds ?? 0)),
          String(Math.round(sessions.avgSessionDurationSeconds)),
          query.channel ?? 'all',
          query.window ?? ReportsTimeWindow.ALL,
        ],
      ];

      return {
        fileName: `sessions-summary-${timestamp}.csv`,
        csv: this.toCsv(rows),
      };
    }

    if (!query.campaignId) {
      throw new NotFoundException(
        'campaignId is required for campaign detail export',
      );
    }

    const detail = await this.getCampaignDetail(query.campaignId, {
      window: query.window,
    }, tenantId);

    const rows = [
      [
        'campaign_id',
        'campaign_name',
        'total_contacts',
        'pending_sessions',
        'active_sessions',
        'completed_sessions',
        'abandoned_sessions',
        'avg_response_time_seconds',
        'avg_session_duration_seconds',
        'window',
      ],
      [
        detail.campaignId,
        detail.name,
        String(detail.totalContacts),
        String(detail.sessions.pending),
        String(detail.sessions.active),
        String(detail.sessions.completed),
        String(detail.sessions.abandoned),
        String(Math.round(detail.avgResponseTimeSeconds)),
        String(Math.round(detail.avgSessionDurationSeconds)),
        query.window ?? ReportsTimeWindow.ALL,
      ],
    ];

    return {
      fileName: `campaign-detail-${detail.campaignId}-${timestamp}.csv`,
      csv: this.toCsv(rows),
    };
  }

  async buildJsonExport(query: ExportReportsQueryDto, tenantId: string) {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const window = query.window ?? ReportsTimeWindow.ALL;

    if (query.kind === ReportsExportKind.CAMPAIGNS) {
      const items = query.all
        ? await this.getAllCampaignReports(query.window, query.channel, tenantId)
        : (
            await this.getCampaignsOverview({
              page: query.page,
              limit: query.limit,
              window: query.window,
              channel: query.channel,
            }, tenantId)
          ).items;

      return {
        fileName: `campaign-overview-${timestamp}.json`,
        json: JSON.stringify(
          {
            kind: ReportsExportKind.CAMPAIGNS,
            format: ReportsExportFormat.JSON,
            window,
            all: Boolean(query.all),
            items,
          },
          null,
          2,
        ),
      };
    }

    if (query.kind === ReportsExportKind.AGENTS) {
      const items = query.all
        ? await this.getAllAgentReports(query.window, query.channel, tenantId)
        : (
            await this.getAgentsReport({
              page: query.page,
              limit: query.limit,
              window: query.window,
              channel: query.channel,
            }, tenantId)
          ).items;

      return {
        fileName: `agent-performance-${timestamp}.json`,
        json: JSON.stringify(
          {
            kind: ReportsExportKind.AGENTS,
            format: ReportsExportFormat.JSON,
            window,
            channel: query.channel ?? 'all',
            all: Boolean(query.all),
            items,
          },
          null,
          2,
        ),
      };
    }

    if (query.kind === ReportsExportKind.SESSIONS) {
      const summary = await this.getSessionsReport({
        window: query.window,
        channel: query.channel,
      }, tenantId);
      return {
        fileName: `sessions-summary-${timestamp}.json`,
        json: JSON.stringify(
          {
            kind: ReportsExportKind.SESSIONS,
            format: ReportsExportFormat.JSON,
            window,
            channel: query.channel ?? 'all',
            all: Boolean(query.all),
            summary,
          },
          null,
          2,
        ),
      };
    }

    if (!query.campaignId) {
      throw new NotFoundException(
        'campaignId is required for campaign detail export',
      );
    }

    const detail = await this.getCampaignDetail(query.campaignId, {
      window: query.window,
    }, tenantId);

    return {
      fileName: `campaign-detail-${detail.campaignId}-${timestamp}.json`,
      json: JSON.stringify(
        {
          kind: ReportsExportKind.CAMPAIGN_DETAIL,
          format: ReportsExportFormat.JSON,
          window,
          all: Boolean(query.all),
          detail,
        },
        null,
        2,
      ),
    };
  }

  getCampaignExportHeader() {
    return [
      'campaign_id',
      'campaign_name',
      'channel',
      'total_contacts',
      'pending_sessions',
      'active_sessions',
      'completed_sessions',
      'abandoned_sessions',
      'window',
    ];
  }

  getAgentsExportHeader() {
    return [
      'agent_id',
      'full_name',
      'email',
      'handled_sessions',
      'completed_sessions',
      'avg_session_duration_seconds',
      'is_online',
      'channel_filter',
      'window',
    ];
  }

  async *iterateCampaignExportRows(
    window: ReportsTimeWindow | undefined,
    channel: CampaignChannel | undefined,
    tenantId: string,
  ) {
    const total = await this.getCampaignExportTotal(window, channel, tenantId);
    if (total > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export rows exceeded limit (${MAX_EXPORT_ROWS}). Narrow the window or use paginated export.`,
      );
    }

    const limit = 200;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const windowLabel = window ?? ReportsTimeWindow.ALL;

    for (let page = 1; page <= totalPages; page += 1) {
      const batch = await this.getCampaignsOverview({
        page,
        limit,
        window,
        channel,
      }, tenantId);
      for (const campaign of batch.items) {
        yield [
          campaign.campaignId,
          campaign.name,
          campaign.channel,
          String(campaign.totalContacts),
          String(campaign.sessions.pending),
          String(campaign.sessions.active),
          String(campaign.sessions.completed),
          String(campaign.sessions.abandoned),
          windowLabel,
        ];
      }
    }
  }

  async *iterateAgentExportRows(
    window: ReportsTimeWindow | undefined,
    channel: CampaignChannel | undefined,
    tenantId: string,
  ) {
    const total = await this.getAgentExportTotal(window, channel, tenantId);
    if (total > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export rows exceeded limit (${MAX_EXPORT_ROWS}). Narrow the window or use paginated export.`,
      );
    }

    const limit = 200;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const windowLabel = window ?? ReportsTimeWindow.ALL;

    for (let page = 1; page <= totalPages; page += 1) {
      const batch = await this.getAgentsReport({
        page,
        limit,
        window,
        channel,
      }, tenantId);
      for (const agent of batch.items) {
        yield [
          agent.agentId,
          agent.fullName,
          agent.email,
          String(agent.handledSessions),
          String(agent.completedSessions),
          String(Math.round(agent.avgSessionDurationSeconds ?? 0)),
          agent.isOnline ? 'online' : 'offline',
          channel ?? 'all',
          windowLabel,
        ];
      }
    }
  }

  toCsvLine(cells: string[]) {
    return `${cells.map((value) => this.escapeCsvCell(value)).join(',')}\n`;
  }

  async getCampaignDetail(id: string, query: ListReportsQueryDto, tenantId: string) {
    const windowStartAt = this.getWindowStartDate(query.window);
    const campaign = await this.campaignsRepository.findOne({ where: { id, tenantId } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const totalContacts = await this.campaignContactsRepository.count({
      where: { campaignId: id },
    });

    const sessionsQb = this.sessionsRepository
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.campaignId = :campaignId', { campaignId: id })
      .andWhere('s.tenantId = :tenantId', { tenantId })
      .groupBy('s.status');

    if (windowStartAt) {
      sessionsQb.andWhere('s.createdAt >= :windowStartAt', { windowStartAt });
    }

    const sessionsRaw = await sessionsQb.getRawMany<{
      status: ChatSessionStatus;
      count: string;
    }>();

    const sessions = {
      pending: 0,
      active: 0,
      completed: 0,
      abandoned: 0,
    };

    for (const row of sessionsRaw) {
      const count = Number(row.count);
      if (row.status === ChatSessionStatus.PENDING) sessions.pending = count;
      if (row.status === ChatSessionStatus.ACTIVE) sessions.active = count;
      if (row.status === ChatSessionStatus.COMPLETED)
        sessions.completed = count;
      if (row.status === ChatSessionStatus.ABANDONED)
        sessions.abandoned = count;
    }

    const durationRaw = await this.sessionsRepository
      .createQueryBuilder('s')
      .select(
        'AVG(EXTRACT(EPOCH FROM (s.endedAt - s.startedAt)))',
        'avgDuration',
      )
      .where('s.campaignId = :campaignId', { campaignId: id })
      .andWhere('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.startedAt IS NOT NULL')
      .andWhere('s.endedAt IS NOT NULL')
      .andWhere(windowStartAt ? 's.createdAt >= :windowStartAt' : '1=1', {
        windowStartAt,
      })
      .getRawOne<{ avgDuration: string | null }>();

    const firstCustomerSubQuery = this.messagesRepository
      .createQueryBuilder('m_customer')
      .select('m_customer.sessionId', 'session_id')
      .addSelect('MIN(m_customer.createdAt)', 'first_customer_at')
      .where('m_customer.senderType = :customerSenderType', {
        customerSenderType: MessageSenderType.CUSTOMER,
      })
      .groupBy('m_customer.sessionId');

    const firstAgentSubQuery = this.messagesRepository
      .createQueryBuilder('m_agent')
      .select('m_agent.sessionId', 'session_id')
      .addSelect('MIN(m_agent.createdAt)', 'first_agent_at')
      .where('m_agent.senderType = :agentSenderType', {
        agentSenderType: MessageSenderType.AGENT,
      })
      .groupBy('m_agent.sessionId');

    const responseTimeQb = this.sessionsRepository
      .createQueryBuilder('s')
      .select(
        'AVG(EXTRACT(EPOCH FROM (first_agent.first_agent_at - first_customer.first_customer_at)))',
        'avgResponse',
      )
      .innerJoin(
        `(${firstCustomerSubQuery.getQuery()})`,
        'first_customer',
        'first_customer.session_id = s.id',
      )
      .innerJoin(
        `(${firstAgentSubQuery.getQuery()})`,
        'first_agent',
        'first_agent.session_id = s.id AND first_agent.first_agent_at >= first_customer.first_customer_at',
      )
      .where('s.campaignId = :campaignId', { campaignId: id })
      .andWhere('s.tenantId = :tenantId', { tenantId })
      .setParameters({
        ...firstCustomerSubQuery.getParameters(),
        ...firstAgentSubQuery.getParameters(),
      });

    if (windowStartAt) {
      responseTimeQb.andWhere('s.createdAt >= :windowStartAt', {
        windowStartAt,
      });
    }

    const responseRaw = await responseTimeQb.getRawOne<{
      avgResponse: string | null;
    }>();

    return {
      campaignId: campaign.id,
      name: campaign.name,
      totalContacts,
      sessions,
      avgResponseTimeSeconds: Number(responseRaw?.avgResponse ?? 0),
      avgSessionDurationSeconds: Number(durationRaw?.avgDuration ?? 0),
    };
  }

  async getAgentsReport(query: ListReportsQueryDto, tenantId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const windowStartAt = this.getWindowStartDate(query.window);

    const [agents, total] = await this.usersRepository.findAndCount({
      where: { role: UserRole.AGENT, tenantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (agents.length === 0) {
      return {
        items: [],
        meta: { page, limit, total },
      };
    }

    const agentIds = agents.map((a) => a.id);
    const sessionsQb = this.sessionsRepository
      .createQueryBuilder('s')
      .select(['s.agentId', 's.status', 's.startedAt', 's.endedAt'])
      .where('s.agentId IN (:...agentIds)', { agentIds })
      .andWhere('s.tenantId = :tenantId', { tenantId });

    if (query.channel) {
      sessionsQb.andWhere('s.channel = :channel', { channel: query.channel });
    }

    if (windowStartAt) {
      sessionsQb.andWhere('s.createdAt >= :windowStartAt', { windowStartAt });
    }

    const sessions = await sessionsQb.getMany();

    const statsMap = new Map<
      string,
      {
        handledSessions: number;
        completedSessions: number;
        avgSessionDurationSeconds: number;
      }
    >();

    for (const agentId of agentIds) {
      statsMap.set(agentId, {
        handledSessions: 0,
        completedSessions: 0,
        avgSessionDurationSeconds: 0,
      });
    }

    const durationSums = new Map<string, { sum: number; count: number }>();

    for (const row of sessions) {
      if (!row.agentId) continue;
      const stat = statsMap.get(row.agentId);
      if (!stat) continue;

      stat.handledSessions += 1;
      if (row.status === ChatSessionStatus.COMPLETED) {
        stat.completedSessions += 1;
      }

      if (row.startedAt && row.endedAt) {
        const durationSeconds =
          (row.endedAt.getTime() - row.startedAt.getTime()) / 1000;
        const prev = durationSums.get(row.agentId) ?? { sum: 0, count: 0 };
        durationSums.set(row.agentId, {
          sum: prev.sum + durationSeconds,
          count: prev.count + 1,
        });
      }
    }

    for (const [agentId, value] of durationSums.entries()) {
      const stat = statsMap.get(agentId);
      if (!stat || value.count === 0) continue;
      stat.avgSessionDurationSeconds = value.sum / value.count;
    }

    const items = agents.map((agent) => ({
      agentId: agent.id,
      fullName: agent.fullName,
      email: agent.email,
      isOnline: agent.isOnline,
      ...statsMap.get(agent.id),
    }));

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async getSessionsReport(query: ListReportsQueryDto, tenantId: string) {
    const windowStartAt = this.getWindowStartDate(query.window);

    const sessionsBaseQb = this.sessionsRepository
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId });
    if (query.channel) {
      sessionsBaseQb.andWhere('s.channel = :channel', {
        channel: query.channel,
      });
    }
    if (windowStartAt) {
      sessionsBaseQb.andWhere('s.createdAt >= :windowStartAt', {
        windowStartAt,
      });
    }

    const totalSessions = await sessionsBaseQb.getCount();

    const statusQb = this.sessionsRepository
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.tenantId = :tenantId', { tenantId })
      .groupBy('s.status');

    if (query.channel) {
      statusQb.andWhere('s.channel = :channel', { channel: query.channel });
    }

    if (windowStartAt) {
      statusQb.andWhere('s.createdAt >= :windowStartAt', { windowStartAt });
    }

    const statusRaw = await statusQb.getRawMany<{
      status: ChatSessionStatus;
      count: string;
    }>();

    const byStatus = {
      pending: 0,
      active: 0,
      completed: 0,
      abandoned: 0,
    };

    for (const row of statusRaw) {
      const count = Number(row.count);
      if (row.status === ChatSessionStatus.PENDING) byStatus.pending = count;
      if (row.status === ChatSessionStatus.ACTIVE) byStatus.active = count;
      if (row.status === ChatSessionStatus.COMPLETED)
        byStatus.completed = count;
      if (row.status === ChatSessionStatus.ABANDONED)
        byStatus.abandoned = count;
    }

    const durationQb = this.sessionsRepository
      .createQueryBuilder('s')
      .select(
        'AVG(EXTRACT(EPOCH FROM (s.endedAt - s.startedAt)))',
        'avgDuration',
      )
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.startedAt IS NOT NULL')
      .andWhere('s.endedAt IS NOT NULL');

    if (query.channel) {
      durationQb.andWhere('s.channel = :channel', { channel: query.channel });
    }

    if (windowStartAt) {
      durationQb.andWhere('s.createdAt >= :windowStartAt', { windowStartAt });
    }

    const durationRaw = await durationQb.getRawOne<{
      avgDuration: string | null;
    }>();

    const firstCustomerSubQuery = this.messagesRepository
      .createQueryBuilder('m_customer')
      .select('m_customer.sessionId', 'session_id')
      .addSelect('MIN(m_customer.createdAt)', 'first_customer_at')
      .where('m_customer.senderType = :customerSenderType', {
        customerSenderType: MessageSenderType.CUSTOMER,
      })
      .groupBy('m_customer.sessionId');

    const firstAgentSubQuery = this.messagesRepository
      .createQueryBuilder('m_agent')
      .select('m_agent.sessionId', 'session_id')
      .addSelect('MIN(m_agent.createdAt)', 'first_agent_at')
      .where('m_agent.senderType = :agentSenderType', {
        agentSenderType: MessageSenderType.AGENT,
      })
      .groupBy('m_agent.sessionId');

    const responseTimeQb = this.sessionsRepository
      .createQueryBuilder('s')
      .select(
        'AVG(EXTRACT(EPOCH FROM (first_agent.first_agent_at - first_customer.first_customer_at)))',
        'avgResponse',
      )
      .innerJoin(
        `(${firstCustomerSubQuery.getQuery()})`,
        'first_customer',
        'first_customer.session_id = s.id',
      )
      .innerJoin(
        `(${firstAgentSubQuery.getQuery()})`,
        'first_agent',
        'first_agent.session_id = s.id AND first_agent.first_agent_at >= first_customer.first_customer_at',
      )
      .where('s.tenantId = :tenantId', { tenantId })
      .setParameters({
        ...firstCustomerSubQuery.getParameters(),
        ...firstAgentSubQuery.getParameters(),
      });

    if (query.channel) {
      responseTimeQb.andWhere('s.channel = :channel', {
        channel: query.channel,
      });
    }

    if (windowStartAt) {
      responseTimeQb.andWhere('s.createdAt >= :windowStartAt', {
        windowStartAt,
      });
    }

    const responseRaw = await responseTimeQb.getRawOne<{
      avgResponse: string | null;
    }>();

    return {
      totalSessions,
      byStatus,
      avgSessionDurationSeconds: Number(durationRaw?.avgDuration ?? 0),
      avgResponseTimeSeconds: Number(responseRaw?.avgResponse ?? 0),
    };
  }

  private getWindowStartDate(window?: ReportsTimeWindow): Date | null {
    if (!window || window === ReportsTimeWindow.ALL) {
      return null;
    }

    const now = new Date();

    if (window === ReportsTimeWindow.LAST_24_HOURS) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    if (window === ReportsTimeWindow.LAST_7_DAYS) {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    if (window === ReportsTimeWindow.LAST_30_DAYS) {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return null;
  }

  private toCsv(rows: string[][]) {
    return rows
      .map((row) => row.map((value) => this.escapeCsvCell(value)).join(','))
      .join('\n');
  }

  private escapeCsvCell(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private async getCampaignExportTotal(
    window: ReportsTimeWindow | undefined,
    channel: CampaignChannel | undefined,
    tenantId: string,
  ) {
    const result = await this.getCampaignsOverview({
      page: 1,
      limit: 1,
      window,
      channel,
    }, tenantId);
    return result.meta.total;
  }

  private async getAgentExportTotal(
    window: ReportsTimeWindow | undefined,
    channel: CampaignChannel | undefined,
    tenantId: string,
  ) {
    const result = await this.getAgentsReport({
      page: 1,
      limit: 1,
      window,
      channel,
    }, tenantId);
    return result.meta.total;
  }

  private async getAllCampaignReports(
    window: ReportsTimeWindow | undefined,
    channel: CampaignChannel | undefined,
    tenantId: string,
  ) {
    const firstPage = await this.getCampaignsOverview({
      page: 1,
      limit: 1,
      window,
      channel,
    }, tenantId);
    if (firstPage.meta.total > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export rows exceeded limit (${MAX_EXPORT_ROWS}). Narrow the window or use paginated export.`,
      );
    }

    const limit = 200;
    let page = 1;
    let total = 0;
    const items: Awaited<
      ReturnType<ReportsService['getCampaignsOverview']>
    >['items'] = [];

    do {
      const batch = await this.getCampaignsOverview({
        page,
        limit,
        window,
        channel,
      }, tenantId);
      total = batch.meta.total;
      items.push(...batch.items);
      page += 1;
    } while (items.length < total);

    return items;
  }

  private async getAllAgentReports(
    window: ReportsTimeWindow | undefined,
    channel: CampaignChannel | undefined,
    tenantId: string,
  ) {
    const firstPage = await this.getAgentsReport({
      page: 1,
      limit: 1,
      window,
      channel,
    }, tenantId);
    if (firstPage.meta.total > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export rows exceeded limit (${MAX_EXPORT_ROWS}). Narrow the window or use paginated export.`,
      );
    }

    const limit = 200;
    let page = 1;
    let total = 0;
    const items: Awaited<
      ReturnType<ReportsService['getAgentsReport']>
    >['items'] = [];

    do {
      const batch = await this.getAgentsReport({
        page,
        limit,
        window,
        channel,
      }, tenantId);
      total = batch.meta.total;
      items.push(...batch.items);
      page += 1;
    } while (items.length < total);

    return items;
  }
}
