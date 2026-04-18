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

type PhoneNumberCampaignMap = Record<string, string | string[]>;

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
    } else {
      this.logger.debug(
        `Skip WhatsApp outbound for session=${session.id} because channel=${session.channel}`,
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

    let parsedMap: PhoneNumberCampaignMap;
    try {
      parsedMap = JSON.parse(rawMap) as PhoneNumberCampaignMap;
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

  async endSession(sessionId: string): Promise<ChatSession> {
    const session = await this.ensureSessionExists(sessionId);
    session.status = ChatSessionStatus.COMPLETED;
    session.endedAt = new Date();

    return this.sessionsRepository.save(session);
  }
}
