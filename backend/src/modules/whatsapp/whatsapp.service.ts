import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  Campaign,
  CampaignAgent,
  CampaignChannel,
  ChannelCampaignMapping,
  CampaignContact,
  CampaignContactStatus,
  CampaignStatus,
  CampaignType,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  Contact,
  MessageSenderType,
  MessageType,
  SessionChannel,
  ExternalChannel,
  User,
  UserRole,
} from '../../database/entities';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { SessionsService } from '../sessions/sessions.service';
import { AiService } from '../ai/ai.service';
import { type NormalizedInboundMessage } from './whatsapp-inbound.adapter';
import { MetaInboundAdapterRegistry } from './adapters/meta-inbound-adapter.registry';
import { WhatsappInboundMessageDto } from './dto/whatsapp-inbound-message.dto';

type ProcessedInboundMessage = {
  sessionId: string;
  messageId: string;
  contactId: string;
  createdSession: boolean;
};

type PhoneNumberCampaignMap = Record<string, string | string[]>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

@Injectable()
export class WhatsappService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
    @InjectRepository(CampaignContact)
    private readonly campaignContactsRepository: Repository<CampaignContact>,
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(CampaignAgent)
    private readonly campaignAgentsRepository: Repository<CampaignAgent>,
    @InjectRepository(ChannelCampaignMapping)
    private readonly channelCampaignMappingsRepository: Repository<ChannelCampaignMapping>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly sessionsService: SessionsService,
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
    private readonly inboundAdapterRegistry: MetaInboundAdapterRegistry,
  ) {}

  verifyWebhook(
    query: {
      mode?: string;
      challenge?: string;
      verifyToken?: string;
    },
    channel: ExternalChannel = ExternalChannel.WHATSAPP,
  ) {
    const expectedToken = this.resolveVerifyToken(channel);

    if (
      query.mode !== 'subscribe' ||
      !expectedToken ||
      query.verifyToken !== expectedToken
    ) {
      throw new ForbiddenException('Invalid WhatsApp webhook verification');
    }

    return { challenge: query.challenge };
  }

  verifyWebhookSignature(
    request: Request,
    payload: unknown,
    channel: ExternalChannel = ExternalChannel.WHATSAPP,
  ) {
    const appSecret = this.resolveAppSecret(channel);
    if (!appSecret) {
      return;
    }

    const signatureHeader = request.header('x-hub-signature-256');
    if (!signatureHeader) {
      throw new ForbiddenException('Missing WhatsApp webhook signature');
    }

    const [scheme, signature] = signatureHeader.split('=');
    if (scheme !== 'sha256' || !signature) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature format');
    }

    const rawBody =
      (request as Request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(payload));
    const expected = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature');
    }
  }

  async handleInboundMessage(payload: WhatsappInboundMessageDto) {
    return this.handleInboundMessageByChannel(
      ExternalChannel.WHATSAPP,
      payload,
    );
  }

  async handleInboundMessageByChannel(
    channel: ExternalChannel,
    payload: unknown,
  ) {
    const inboundMessages =
      this.inboundAdapterRegistry.normalizeInboundMessages(channel, payload);

    const campaign = await this.resolveCampaign(channel, payload);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!this.isCampaignEligibleForInbound(campaign, channel)) {
      throw new ForbiddenException(
        `Campaign channel must be ${this.mapExternalToCampaignChannel(channel)}`,
      );
    }

    const processed: ProcessedInboundMessage[] = [];

    for (const inbound of inboundMessages) {
      const contact = await this.resolveContact(inbound, channel, campaign.tenantId || 'chat-support-platform');
      await this.ensureCampaignContactLink(campaign.id, contact.id);

      let session = await this.findOpenSession(
        campaign.id,
        contact.id,
        this.mapExternalToSessionChannel(channel),
      );
      let createdSession = false;

      if (!session) {
        const autoAssignedAgentId = await this.resolveAutoAssignableAgentId(
          campaign.id,
        );

        session = await this.sessionsService.create({
          campaignId: campaign.id,
          contactId: contact.id,
          agentId: autoAssignedAgentId ?? undefined,
          channel: this.mapExternalToSessionChannel(channel),
        });

        if (autoAssignedAgentId) {
          await this.markCampaignContactAssigned(campaign.id, contact.id);
        }

        createdSession = true;
      }

      const message = await this.messagesRepository.save(
        this.messagesRepository.create({
          sessionId: session.id,
          senderType: MessageSenderType.CUSTOMER,
          senderId: null,
          content: inbound.message,
          messageType: inbound.messageType,
          attachmentUrl: inbound.attachmentUrl,
          isRead: false,
        }),
      );

      this.chatGateway.emitSessionMessage(session.id, message);

      await this.maybeAutoReplyForInbound({
        session,
        campaign,
        contact,
        inbound,
        channel,
      });

      processed.push({
        sessionId: session.id,
        messageId: message.id,
        contactId: contact.id,
        createdSession,
      });
    }

    return {
      totalProcessed: processed.length,
      processed,
    };
  }

  private async maybeAutoReplyForInbound(input: {
    session: ChatSession;
    campaign: Campaign;
    contact: Contact;
    inbound: NormalizedInboundMessage;
    channel: ExternalChannel;
  }) {
    const sessionChannel = this.mapExternalToSessionChannel(input.channel);
    if (!this.aiService.isAutoReplyEnabled(sessionChannel)) {
      return;
    }

    const messageText = input.inbound.message?.trim();
    const customerMessage =
      messageText ||
      (input.inbound.attachmentUrl ? 'Customer sent an attachment.' : '');

    if (!customerMessage) {
      return;
    }

    const reply = await this.aiService.generateAutoReply({
      channel: sessionChannel,
      campaignName: input.campaign.name,
      customerName: input.contact.fullName,
      customerMessage,
    });

    if (!reply) {
      return;
    }

    const message = await this.chatService.saveIncomingMessage({
      sessionId: input.session.id,
      content: reply,
      messageType: MessageType.TEXT,
    });

    this.chatGateway.emitSessionMessage(input.session.id, message);
  }

  private async resolveContact(
    payload: NormalizedInboundMessage,
    channel: ExternalChannel,
    tenantId: string,
  ) {
    const externalContactId = this.toContactExternalId(channel, payload.from);

    const existingContact = await this.contactsRepository.findOne({
      where: { whatsappId: externalContactId, tenantId },
    });

    if (existingContact) {
      return existingContact;
    }

    return this.contactsRepository.save(
      this.contactsRepository.create({
        fullName: payload.contactName?.trim() || payload.from,
        whatsappId: externalContactId,
        phone: null,
        email: null,
        tenantId,
        metadata: {
          source: `${channel}-webhook`,
          externalContactId: payload.from,
          channel,
        },
      }),
    );
  }

  private async ensureCampaignContactLink(
    campaignId: string,
    contactId: string,
  ) {
    const existingLink = await this.campaignContactsRepository.findOne({
      where: { campaignId, contactId },
    });

    if (existingLink) {
      return existingLink;
    }

    return this.campaignContactsRepository.save(
      this.campaignContactsRepository.create({
        campaignId,
        contactId,
        status: CampaignContactStatus.PENDING,
        importBatch: 'whatsapp-webhook',
        assignedAt: null,
      }),
    );
  }

  private async findOpenSession(
    campaignId: string,
    contactId: string,
    sessionChannel: SessionChannel,
  ) {
    return this.sessionsRepository.findOne({
      where: {
        campaignId,
        contactId,
        channel: sessionChannel,
        status: In([ChatSessionStatus.PENDING, ChatSessionStatus.ACTIVE]),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  private async markCampaignContactAssigned(
    campaignId: string,
    contactId: string,
  ) {
    await this.campaignContactsRepository.update(
      { campaignId, contactId },
      {
        status: CampaignContactStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    );
  }

  private async resolveAutoAssignableAgentId(campaignId: string) {
    if (!this.isAutoAssignEnabled()) {
      return null;
    }

    const assignments = await this.campaignAgentsRepository.find({
      where: { campaignId },
      order: { assignedAt: 'ASC' },
    });

    if (assignments.length === 0) {
      return null;
    }

    const agentIds = assignments.map((assignment) => assignment.agentId);

    const onlineAgents = await this.usersRepository.find({
      where: {
        id: In(agentIds),
        role: UserRole.AGENT,
        isActive: true,
        isOnline: true,
      },
      select: { id: true },
    });

    if (onlineAgents.length === 0) {
      return null;
    }

    const onlineAgentIds = new Set(onlineAgents.map((agent) => agent.id));
    for (const assignment of assignments) {
      if (onlineAgentIds.has(assignment.agentId)) {
        return assignment.agentId;
      }
    }

    return null;
  }

  private isAutoAssignEnabled() {
    const rawFlag = process.env.WHATSAPP_AUTO_ASSIGN_ENABLED?.trim();

    return rawFlag === '1' || rawFlag?.toLowerCase() === 'true';
  }

  private async resolveCampaign(channel: ExternalChannel, payload: unknown) {
    const payloadRecord = asRecord(payload);
    const directCampaignId =
      payloadRecord && typeof payloadRecord.campaignId === 'string'
        ? payloadRecord.campaignId
        : undefined;

    if (directCampaignId) {
      const campaign = await this.campaignsRepository.findOne({
        where: { id: directCampaignId },
      });

      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      if (!this.isCampaignEligibleForInbound(campaign, channel)) {
        throw new ForbiddenException(
          `Campaign is not eligible for inbound ${channel} messages`,
        );
      }

      return campaign;
    }

    const externalAccountIds =
      this.inboundAdapterRegistry.extractExternalAccountIds(channel, payload);

    const candidateCampaignIdsFromDb =
      await this.resolveCampaignIdsFromChannelMappings(
        channel,
        externalAccountIds,
      );
    const candidateCampaignIds =
      candidateCampaignIdsFromDb.length > 0
        ? candidateCampaignIdsFromDb
        : channel === ExternalChannel.WHATSAPP
          ? this.resolveCampaignIdsFromPhoneNumberMap(externalAccountIds)
          : [];

    if (candidateCampaignIds.length === 0) {
      throw new BadRequestException(
        'campaignId is required when phone_number_id mapping is not configured',
      );
    }

    const campaigns = await this.campaignsRepository.find({
      where: { id: In(candidateCampaignIds) },
    });

    const eligibleById = new Map<string, Campaign>();
    for (const campaign of campaigns) {
      if (this.isCampaignEligibleForInbound(campaign, channel)) {
        eligibleById.set(campaign.id, campaign);
      }
    }

    for (const campaignId of candidateCampaignIds) {
      const selectedCampaign = eligibleById.get(campaignId);
      if (selectedCampaign) {
        return selectedCampaign;
      }
    }

    throw new NotFoundException(
      'No eligible campaign found for incoming phone_number_id',
    );
  }

  private resolveCampaignIdsFromPhoneNumberMap(phoneNumberIds: string[]) {
    if (phoneNumberIds.length === 0) {
      return [];
    }

    const rawMap = process.env.WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP?.trim();
    if (!rawMap) {
      return [];
    }

    let parsedMap: PhoneNumberCampaignMap;
    try {
      parsedMap = JSON.parse(rawMap) as PhoneNumberCampaignMap;
    } catch {
      throw new BadRequestException(
        'Invalid WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP format',
      );
    }

    const resolvedCampaignIds: string[] = [];
    const seen = new Set<string>();

    for (const phoneNumberId of phoneNumberIds) {
      const mappedValue = parsedMap[phoneNumberId];
      const campaignIds = Array.isArray(mappedValue)
        ? mappedValue
        : typeof mappedValue === 'string'
          ? [mappedValue]
          : [];

      for (const campaignId of campaignIds) {
        const normalizedCampaignId = campaignId.trim();
        if (!normalizedCampaignId || seen.has(normalizedCampaignId)) {
          continue;
        }

        seen.add(normalizedCampaignId);
        resolvedCampaignIds.push(normalizedCampaignId);
      }
    }

    return resolvedCampaignIds;
  }

  private async resolveCampaignIdsFromChannelMappings(
    channel: ExternalChannel,
    externalAccountIds: string[],
  ) {
    if (externalAccountIds.length === 0) {
      return [];
    }

    const mappings = await this.channelCampaignMappingsRepository.find({
      where: {
        channel,
        isActive: true,
        externalAccountId: In(externalAccountIds),
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
    });

    if (mappings.length === 0) {
      return [];
    }

    const accountOrder = new Map(
      externalAccountIds.map((externalAccountId, index) => [
        externalAccountId,
        index,
      ]),
    );

    mappings.sort((left, right) => {
      const leftOrder =
        accountOrder.get(left.externalAccountId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder =
        accountOrder.get(right.externalAccountId) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });

    const resolvedCampaignIds: string[] = [];
    const seen = new Set<string>();

    for (const mapping of mappings) {
      if (seen.has(mapping.campaignId)) {
        continue;
      }

      seen.add(mapping.campaignId);
      resolvedCampaignIds.push(mapping.campaignId);
    }

    return resolvedCampaignIds;
  }

  private isCampaignEligibleForInbound(
    campaign: Campaign,
    inboundChannel: ExternalChannel,
  ) {
    if (
      campaign.channel !== this.mapExternalToCampaignChannel(inboundChannel)
    ) {
      return false;
    }

    if (campaign.status !== CampaignStatus.ACTIVE) {
      return false;
    }

    if (campaign.type !== CampaignType.INBOUND) {
      return false;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (campaign.startDate && campaign.startDate > today) {
      return false;
    }

    if (campaign.endDate && campaign.endDate < today) {
      return false;
    }

    return true;
  }

  private mapExternalToCampaignChannel(
    channel: ExternalChannel,
  ): CampaignChannel {
    if (channel === ExternalChannel.WHATSAPP) {
      return CampaignChannel.WHATSAPP;
    }

    if (channel === ExternalChannel.INSTAGRAM) {
      return CampaignChannel.INSTAGRAM;
    }

    return CampaignChannel.MESSENGER;
  }

  private mapExternalToSessionChannel(
    channel: ExternalChannel,
  ): SessionChannel {
    if (channel === ExternalChannel.WHATSAPP) {
      return SessionChannel.WHATSAPP;
    }

    if (channel === ExternalChannel.INSTAGRAM) {
      return SessionChannel.INSTAGRAM;
    }

    return SessionChannel.MESSENGER;
  }

  private toContactExternalId(channel: ExternalChannel, from: string) {
    if (channel === ExternalChannel.WHATSAPP) {
      return from;
    }

    return `${channel}:${from}`;
  }

  private resolveVerifyToken(channel: ExternalChannel) {
    if (channel === ExternalChannel.WHATSAPP) {
      return process.env.WHATSAPP_VERIFY_TOKEN?.trim();
    }

    if (channel === ExternalChannel.INSTAGRAM) {
      return (
        process.env.INSTAGRAM_VERIFY_TOKEN?.trim() ??
        process.env.META_VERIFY_TOKEN?.trim()
      );
    }

    return (
      process.env.MESSENGER_VERIFY_TOKEN?.trim() ??
      process.env.META_VERIFY_TOKEN?.trim()
    );
  }

  private resolveAppSecret(channel: ExternalChannel) {
    if (channel === ExternalChannel.WHATSAPP) {
      return process.env.WHATSAPP_APP_SECRET?.trim();
    }

    if (channel === ExternalChannel.INSTAGRAM) {
      return (
        process.env.INSTAGRAM_APP_SECRET?.trim() ??
        process.env.META_APP_SECRET?.trim()
      );
    }

    return (
      process.env.MESSENGER_APP_SECRET?.trim() ??
      process.env.META_APP_SECRET?.trim()
    );
  }
}
