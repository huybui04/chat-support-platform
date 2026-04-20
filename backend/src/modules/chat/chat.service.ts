import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Campaign,
  ChannelCampaignMapping,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  ExternalChannel,
  MessageSenderType,
  MessageType,
  SessionChannel,
} from '../../database/entities';
import { SendMessageDto } from './dto/send-message.dto';

type ExternalAccountCampaignMap = Record<string, string | string[]>;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(ChannelCampaignMapping)
    private readonly channelMappingsRepository: Repository<ChannelCampaignMapping>,
  ) {}

  async ensureSessionExists(sessionId: string): Promise<ChatSession> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async saveIncomingMessage(payload: SendMessageDto): Promise<ChatMessage> {
    const session = await this.ensureSessionExists(payload.sessionId);

    if (session.channel === SessionChannel.WHATSAPP) {
      this.logger.debug(
        `Sending WhatsApp outbound for session=${session.id} campaign=${session.campaignId}`,
      );
      await this.sendWhatsappOutboundMessage(session, payload);
    } else if (session.channel === SessionChannel.INSTAGRAM) {
      this.logger.debug(
        `Sending Instagram outbound for session=${session.id} campaign=${session.campaignId}`,
      );
      await this.sendInstagramOutboundMessage(session, payload);
    } else if (session.channel === SessionChannel.MESSENGER) {
      this.logger.debug(
        `Sending Messenger outbound for session=${session.id} campaign=${session.campaignId}`,
      );
      await this.sendMessengerOutboundMessage(session, payload);
    } else {
      this.logger.debug(
        `Skip channel outbound for session=${session.id} because channel=${session.channel}`,
      );
    }

    const message = this.messagesRepository.create({
      sessionId: payload.sessionId,
      senderType: MessageSenderType.AGENT,
      senderId: null,
      content: payload.content,
      messageType: payload.messageType ?? MessageType.TEXT,
      attachmentUrl: null,
      isRead: false,
    });

    return this.messagesRepository.save(message);
  }

  private async sendWhatsappOutboundMessage(
    session: ChatSession,
    payload: SendMessageDto,
  ): Promise<void> {
    if (payload.messageType && payload.messageType !== MessageType.TEXT) {
      throw new BadRequestException(
        'WhatsApp outbound currently supports text messages only',
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new BadRequestException('Missing WHATSAPP_ACCESS_TOKEN');
    }

    const sessionWithContact = await this.sessionsRepository.findOne({
      where: { id: session.id },
      relations: { contact: true },
    });

    if (!sessionWithContact?.contact?.whatsappId) {
      throw new BadRequestException(
        'Missing contact whatsappId for outbound WhatsApp message',
      );
    }

    const to = sessionWithContact.contact.whatsappId.replace(/[^\d]/g, '');
    if (!to) {
      throw new BadRequestException('Invalid contact whatsappId format');
    }

    const campaign = await this.campaignsRepository.findOne({
      where: { id: session.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found for session');
    }

    const phoneNumberId = await this.resolvePhoneNumberIdByCampaignId(
      campaign.id,
    );
    if (!phoneNumberId) {
      throw new BadRequestException(
        'Missing phone_number_id mapping for campaign (configure channel_mappings with channel=whatsapp or WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP)',
      );
    }

    const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v25.0';
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: payload.content },
        }),
      },
    );

    if (response.ok) {
      this.logger.debug(
        `WhatsApp outbound success for session=${session.id} to=${to}`,
      );
      return;
    }

    const errorBody = await response.text();
    throw new BadGatewayException(
      `WhatsApp outbound failed (${response.status}): ${errorBody}`,
    );
  }

  private async sendMessengerOutboundMessage(
    session: ChatSession,
    payload: SendMessageDto,
  ): Promise<void> {
    if (payload.messageType && payload.messageType !== MessageType.TEXT) {
      throw new BadRequestException(
        'Messenger outbound currently supports text messages only',
      );
    }

    const accessToken = process.env.MESSENGER_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new BadRequestException('Missing MESSENGER_ACCESS_TOKEN');
    }

    const sessionWithContact = await this.sessionsRepository.findOne({
      where: { id: session.id },
      relations: { contact: true },
    });

    const recipientId = this.normalizeMessengerRecipientId(
      sessionWithContact?.contact?.whatsappId,
    );
    if (!recipientId) {
      throw new BadRequestException(
        'Missing contact id for outbound Messenger message',
      );
    }

    const pageId = await this.resolveMessengerPageIdByCampaignId(
      session.campaignId,
    );
    if (!pageId) {
      throw new BadRequestException(
        'Missing page_id mapping for campaign (configure channel_mappings with channel=messenger or MESSENGER_PAGE_ID_CAMPAIGN_MAP)',
      );
    }

    const apiVersion = process.env.MESSENGER_API_VERSION?.trim() || 'v25.0';
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${pageId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text: payload.content },
        }),
      },
    );

    if (response.ok) {
      this.logger.debug(
        `Messenger outbound success for session=${session.id} to=${recipientId}`,
      );
      return;
    }

    const errorBody = await response.text();
    throw new BadGatewayException(
      `Messenger outbound failed (${response.status}): ${errorBody}`,
    );
  }

  private async sendInstagramOutboundMessage(
    session: ChatSession,
    payload: SendMessageDto,
  ): Promise<void> {
    if (payload.messageType && payload.messageType !== MessageType.TEXT) {
      throw new BadRequestException(
        'Instagram outbound currently supports text messages only',
      );
    }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new BadRequestException('Missing INSTAGRAM_ACCESS_TOKEN');
    }

    const sessionWithContact = await this.sessionsRepository.findOne({
      where: { id: session.id },
      relations: { contact: true },
    });

    const recipientId = this.normalizeInstagramRecipientId(
      sessionWithContact?.contact?.whatsappId,
    );
    if (!recipientId) {
      throw new BadRequestException(
        'Missing contact id for outbound Instagram message',
      );
    }

    const instagramAccountId = await this.resolveInstagramAccountIdByCampaignId(
      session.campaignId,
    );
    if (!instagramAccountId) {
      throw new BadRequestException(
        'Missing instagram_account_id mapping for campaign (configure channel_mappings with channel=instagram or INSTAGRAM_ACCOUNT_ID_CAMPAIGN_MAP)',
      );
    }

    const apiVersion = process.env.INSTAGRAM_API_VERSION?.trim() || 'v25.0';
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${instagramAccountId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text: payload.content },
        }),
      },
    );

    if (response.ok) {
      this.logger.debug(
        `Instagram outbound success for session=${session.id} to=${recipientId}`,
      );
      return;
    }

    const errorBody = await response.text();
    throw new BadGatewayException(
      `Instagram outbound failed (${response.status}): ${errorBody}`,
    );
  }

  private async resolvePhoneNumberIdByCampaignId(
    campaignId: string,
  ): Promise<string | null> {
    const mapping = await this.channelMappingsRepository.findOne({
      where: {
        channel: ExternalChannel.WHATSAPP,
        campaignId,
        isActive: true,
      },
      order: { priority: 'ASC', createdAt: 'ASC' },
      select: {
        externalAccountId: true,
      },
    });

    if (mapping?.externalAccountId?.trim()) {
      return mapping.externalAccountId.trim();
    }

    const rawMap = process.env.WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP?.trim();
    if (!rawMap) {
      return null;
    }

    let parsedMap: ExternalAccountCampaignMap;
    try {
      parsedMap = JSON.parse(rawMap) as ExternalAccountCampaignMap;
    } catch {
      throw new BadRequestException(
        'Invalid WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP format',
      );
    }

    for (const [phoneNumberId, mappedCampaign] of Object.entries(parsedMap)) {
      const mappedCampaignIds = Array.isArray(mappedCampaign)
        ? mappedCampaign
        : typeof mappedCampaign === 'string'
          ? [mappedCampaign]
          : [];

      if (mappedCampaignIds.includes(campaignId)) {
        return phoneNumberId;
      }
    }

    return null;
  }

  private async resolveMessengerPageIdByCampaignId(
    campaignId: string,
  ): Promise<string | null> {
    const mapping = await this.channelMappingsRepository.findOne({
      where: {
        channel: ExternalChannel.MESSENGER,
        campaignId,
        isActive: true,
      },
      order: { priority: 'ASC', createdAt: 'ASC' },
      select: {
        externalAccountId: true,
      },
    });

    if (mapping?.externalAccountId?.trim()) {
      return mapping.externalAccountId.trim();
    }

    const rawMap = process.env.MESSENGER_PAGE_ID_CAMPAIGN_MAP?.trim();
    if (!rawMap) {
      return null;
    }

    let parsedMap: ExternalAccountCampaignMap;
    try {
      parsedMap = JSON.parse(rawMap) as ExternalAccountCampaignMap;
    } catch {
      throw new BadRequestException(
        'Invalid MESSENGER_PAGE_ID_CAMPAIGN_MAP format',
      );
    }

    for (const [pageId, mappedCampaign] of Object.entries(parsedMap)) {
      const mappedCampaignIds = Array.isArray(mappedCampaign)
        ? mappedCampaign
        : typeof mappedCampaign === 'string'
          ? [mappedCampaign]
          : [];

      if (mappedCampaignIds.includes(campaignId)) {
        return pageId;
      }
    }

    return null;
  }

  private async resolveInstagramAccountIdByCampaignId(
    campaignId: string,
  ): Promise<string | null> {
    const mapping = await this.channelMappingsRepository.findOne({
      where: {
        channel: ExternalChannel.INSTAGRAM,
        campaignId,
        isActive: true,
      },
      order: { priority: 'ASC', createdAt: 'ASC' },
      select: {
        externalAccountId: true,
      },
    });

    if (mapping?.externalAccountId?.trim()) {
      return mapping.externalAccountId.trim();
    }

    const rawMap = process.env.INSTAGRAM_ACCOUNT_ID_CAMPAIGN_MAP?.trim();
    if (!rawMap) {
      return null;
    }

    let parsedMap: ExternalAccountCampaignMap;
    try {
      parsedMap = JSON.parse(rawMap) as ExternalAccountCampaignMap;
    } catch {
      throw new BadRequestException(
        'Invalid INSTAGRAM_ACCOUNT_ID_CAMPAIGN_MAP format',
      );
    }

    for (const [instagramAccountId, mappedCampaign] of Object.entries(
      parsedMap,
    )) {
      const mappedCampaignIds = Array.isArray(mappedCampaign)
        ? mappedCampaign
        : typeof mappedCampaign === 'string'
          ? [mappedCampaign]
          : [];

      if (mappedCampaignIds.includes(campaignId)) {
        return instagramAccountId;
      }
    }

    return null;
  }

  private normalizeMessengerRecipientId(rawContactId?: string | null) {
    if (!rawContactId) {
      return null;
    }

    const normalized = rawContactId.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('messenger:')) {
      return normalized.slice('messenger:'.length);
    }

    return normalized;
  }

  private normalizeInstagramRecipientId(rawContactId?: string | null) {
    if (!rawContactId) {
      return null;
    }

    const normalized = rawContactId.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('instagram:')) {
      return normalized.slice('instagram:'.length);
    }

    return normalized;
  }

  async endSession(sessionId: string): Promise<ChatSession> {
    const session = await this.ensureSessionExists(sessionId);
    session.status = ChatSessionStatus.COMPLETED;
    session.endedAt = new Date();

    return this.sessionsRepository.save(session);
  }
}
