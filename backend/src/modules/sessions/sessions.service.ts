import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthUser } from '../../common/auth/auth-user.type';
import {
  CampaignContact,
  CampaignContactStatus,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  User,
} from '../../database/entities';
import { ChatGateway } from '../chat/chat.gateway';
import { AcceptSessionDto } from './dto/accept-session.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(CampaignContact)
    private readonly campaignContactsRepository: Repository<CampaignContact>,
    private readonly chatGateway: ChatGateway,
  ) {}

  async findAll(query: ListSessionsQueryDto) {
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
    const session = await this.sessionsRepository.findOne({ where: { id } });
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

    if (createdSession.status === ChatSessionStatus.PENDING) {
      this.chatGateway.emitNewSessionPending({
        id: createdSession.id,
        status: createdSession.status,
      });
    }

    if (createdSession.status === ChatSessionStatus.ACTIVE) {
      this.chatGateway.emitSessionAssigned({
        id: createdSession.id,
        agentId: createdSession.agentId,
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
    this.chatGateway.emitSessionAssigned({
      id: updatedSession.id,
      agentId: updatedSession.agentId,
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

  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    await this.findById(sessionId);

    return this.messagesRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }
}
