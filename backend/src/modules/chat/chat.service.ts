import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Campaign,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  MessageSenderType,
  MessageType,
  SessionChannel,
} from '../../database/entities';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
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
      await this.sendWhatsappOutboundMessage(session, payload);
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

    const phoneNumberId = this.resolvePhoneNumberIdByCampaignId(campaign.id);
    if (!phoneNumberId) {
      throw new BadRequestException(
        'Missing phone_number_id mapping for campaign in WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP',
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
      return;
    }

    const errorBody = await response.text();
    throw new BadGatewayException(
      `WhatsApp outbound failed (${response.status}): ${errorBody}`,
    );
  }

  private resolvePhoneNumberIdByCampaignId(campaignId: string): string | null {
    const rawMap = process.env.WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP?.trim();
    if (!rawMap) {
      return null;
    }

    let parsedMap: Record<string, string>;
    try {
      parsedMap = JSON.parse(rawMap) as Record<string, string>;
    } catch {
      throw new BadRequestException(
        'Invalid WHATSAPP_PHONE_NUMBER_CAMPAIGN_MAP format',
      );
    }

    for (const [phoneNumberId, mappedCampaignId] of Object.entries(parsedMap)) {
      if (mappedCampaignId === campaignId) {
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
