import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthUser } from '../../common/auth/auth-user.type';
import {
  Campaign,
  CampaignContact,
  CampaignContactStatus,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  SessionChannel,
  User,
  UserRole,
} from '../../database/entities';
import { ChatGateway } from '../chat/chat.gateway';
import { AcceptSessionDto } from './dto/accept-session.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionMessagesQueryDto } from './dto/list-session-messages-query.dto';
import {
  ListSessionsQueryDto,
  SessionVisibilityScope,
} from './dto/list-sessions-query.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(CampaignContact)
    private readonly campaignContactsRepository: Repository<CampaignContact>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async findAll(query: ListSessionsQueryDto, currentUser?: AuthUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.sessionsRepository
      .createQueryBuilder('session')
      .leftJoin('session.campaign', 'campaign')
      .leftJoin('session.contact', 'contact')
      .leftJoin('session.agent', 'agent')
      .addSelect([
        'campaign.id',
        'campaign.name',
        'contact.id',
        'contact.fullName',
        'agent.id',
        'agent.fullName',
      ])
      .orderBy('session.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('session.status = :status', { status: query.status });
    }

    if (query.campaignId) {
      qb.andWhere('session.campaignId = :campaignId', {
        campaignId: query.campaignId,
      });
    }

    if (query.agentId) {
      qb.andWhere('session.agentId = :agentId', {
        agentId: query.agentId,
      });
    }

    if (query.channels?.length) {
      qb.andWhere('session.channel IN (:...channels)', {
        channels: query.channels,
      });
    }

    const isAgentOnlyRequest =
      !!currentUser &&
      currentUser.roles.includes(UserRole.AGENT) &&
      !currentUser.roles.includes(UserRole.SUPERVISOR);

    if (isAgentOnlyRequest) {
      const currentAgent = await this.usersRepository.findOne({
        where: { keycloakId: currentUser.sub },
        select: { id: true },
      });

      if (!currentAgent) {
        throw new NotFoundException('User not found');
      }

      const visibilityScope =
        query.visibilityScope ?? SessionVisibilityScope.TEAM;

      if (visibilityScope === SessionVisibilityScope.AGENT) {
        qb.andWhere(
          `session.campaignId IN (
            SELECT ca.campaign_id
            FROM campaign_agents ca
            WHERE ca.agent_id = :currentAgentUserId
          )`,
          { currentAgentUserId: currentAgent.id },
        );
      } else {
        qb.andWhere(
          `session.campaignId IN (
            SELECT ct.campaign_id
            FROM campaign_teams ct
            INNER JOIN team_members tm ON tm.team_id = ct.team_id
            WHERE tm.user_id = :currentAgentUserId
          )`,
          { currentAgentUserId: currentAgent.id },
        );
      }
    }

    const [items, total] = await qb.getManyAndCount();

    const normalizedItems = items.map((session) => {
      const { campaign, contact, agent, ...base } = session;

      return {
        ...base,
        campaignName: campaign?.name ?? null,
        contactName: contact?.fullName ?? null,
        agentName: agent?.fullName ?? null,
      };
    });

    return {
      items: normalizedItems,
      meta: { page, limit, total },
    };
  }

  async findById(id: string): Promise<ChatSession> {
    const session = await this.sessionsRepository.findOne({
      where: { id },
      relations: ['campaign', 'contact', 'agent'],
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async create(payload: CreateSessionDto): Promise<ChatSession> {
    const session = this.sessionsRepository.create({
      campaignId: payload.campaignId,
      contactId: payload.contactId,
      agentId: payload.agentId ?? null,
      channel: payload.channel,
      status: payload.agentId
        ? ChatSessionStatus.ACTIVE
        : ChatSessionStatus.PENDING,
      startedAt: payload.agentId ? new Date() : null,
    });

    const createdSession = await this.sessionsRepository.save(session);
    const campaignName = await this.resolveCampaignName(
      createdSession.campaignId,
    );

    if (createdSession.status === ChatSessionStatus.PENDING) {
      this.chatGateway.emitNewSessionPending({
        id: createdSession.id,
        status: createdSession.status,
        campaignName,
      });
    }

    if (createdSession.status === ChatSessionStatus.ACTIVE) {
      const agentName = await this.resolveAgentName(createdSession.agentId);
      this.chatGateway.emitSessionAssigned({
        id: createdSession.id,
        agentId: createdSession.agentId,
        agentName,
        campaignName,
      });
    }

    return createdSession;
  }

  async accept(
    id: string,
    payload: AcceptSessionDto,
    currentUser: AuthUser,
  ): Promise<ChatSession> {
    const session = await this.findById(id);

    let resolvedAgentId = payload.agentId;
    if (!resolvedAgentId) {
      const user = await this.usersRepository.findOne({
        where: { keycloakId: currentUser.sub },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      resolvedAgentId = user.id;
    }

    session.agentId = resolvedAgentId;
    session.status = ChatSessionStatus.ACTIVE;
    session.startedAt = session.startedAt ?? new Date();

    await this.campaignContactsRepository.update(
      {
        campaignId: session.campaignId,
        contactId: session.contactId,
      },
      {
        status: CampaignContactStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    );

    const updatedSession = await this.sessionsRepository.save(session);
    const campaignName = await this.resolveCampaignName(
      updatedSession.campaignId,
    );
    const agentName = await this.resolveAgentName(updatedSession.agentId);
    this.chatGateway.emitSessionAssigned({
      id: updatedSession.id,
      agentId: updatedSession.agentId,
      agentName,
      campaignName,
    });

    return updatedSession;
  }

  async end(id: string): Promise<ChatSession> {
    const session = await this.findById(id);
    session.status = ChatSessionStatus.COMPLETED;
    session.endedAt = new Date();

    await this.campaignContactsRepository.update(
      {
        campaignId: session.campaignId,
        contactId: session.contactId,
      },
      {
        status: CampaignContactStatus.COMPLETED,
      },
    );

    this.chatGateway.emitSessionEnded(session.id);

    return this.sessionsRepository.save(session);
  }

  async listMessages(
    sessionId: string,
    query: ListSessionMessagesQueryDto,
  ): Promise<{
    items: ChatMessage[];
    meta: { limit: number; hasMore: boolean; beforeMessageId?: string };
  }> {
    await this.findById(sessionId);

    const limit = query.limit ?? 20;
    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;

    if (query.beforeMessageId) {
      const cursorMessage = await this.messagesRepository.findOne({
        where: { id: query.beforeMessageId, sessionId },
        select: { id: true, createdAt: true },
      });

      if (!cursorMessage) {
        throw new BadRequestException('Invalid beforeMessageId cursor');
      }

      cursorCreatedAt = cursorMessage.createdAt;
      cursorId = cursorMessage.id;
    }

    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .where('message.sessionId = :sessionId', { sessionId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit + 1);

    if (cursorCreatedAt && cursorId) {
      qb.andWhere(
        '(message.createdAt < :cursorCreatedAt OR (message.createdAt = :cursorCreatedAt AND message.id < :cursorId))',
        {
          cursorCreatedAt,
          cursorId,
        },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Keep chronological order for UI rendering while paging newest-first.
    const items = [...pageRows].reverse();
    const nextBeforeMessageId =
      hasMore && items.length > 0 ? items[0].id : undefined;

    return {
      items,
      meta: {
        limit,
        hasMore,
        beforeMessageId: nextBeforeMessageId,
      },
    };
  }

  private async resolveCampaignName(
    campaignId: string,
  ): Promise<string | null> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      select: { id: true, name: true },
    });

    return campaign?.name ?? null;
  }

  private async resolveAgentName(
    agentId: string | null,
  ): Promise<string | null> {
    if (!agentId) {
      return null;
    }

    const agent = await this.usersRepository.findOne({
      where: { id: agentId },
      select: { id: true, fullName: true },
    });

    return agent?.fullName ?? null;
  }
}
