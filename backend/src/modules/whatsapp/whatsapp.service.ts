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
  CampaignChannel,
  CampaignContact,
  CampaignContactStatus,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  Contact,
  MessageSenderType,
  MessageType,
  SessionChannel,
} from '../../database/entities';
import { ChatGateway } from '../chat/chat.gateway';
import { SessionsService } from '../sessions/sessions.service';
import { WhatsappInboundMessageDto } from './dto/whatsapp-inbound-message.dto';

type NormalizedInboundMessage = {
  from: string;
  message: string;
  messageType: MessageType;
  attachmentUrl: string | null;
  contactName?: string;
};

type ProcessedInboundMessage = {
  sessionId: string;
  messageId: string;
  contactId: string;
  createdSession: boolean;
};

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
    private readonly sessionsService: SessionsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  verifyWebhook(query: {
    mode?: string;
    challenge?: string;
    verifyToken?: string;
  }) {
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

    if (
      query.mode !== 'subscribe' ||
      !expectedToken ||
      query.verifyToken !== expectedToken
    ) {
      throw new ForbiddenException('Invalid WhatsApp webhook verification');
    }

    return { challenge: query.challenge };
  }

  verifyWebhookSignature(request: Request, payload: WhatsappInboundMessageDto) {
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
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
    const inboundMessages = this.normalizeInboundMessages(payload);

    const campaign = await this.resolveCampaign(payload);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.channel !== CampaignChannel.WHATSAPP) {
      throw new ForbiddenException('Campaign channel must be whatsapp');
    }

    const processed: ProcessedInboundMessage[] = [];

    for (const inbound of inboundMessages) {
      const contact = await this.resolveContact(inbound);
      await this.ensureCampaignContactLink(campaign.id, contact.id);

      let session = await this.findOpenWhatsappSession(campaign.id, contact.id);
      let createdSession = false;

      if (!session) {
        session = await this.sessionsService.create({
          campaignId: campaign.id,
          contactId: contact.id,
          channel: SessionChannel.WHATSAPP,
        });
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

  private normalizeInboundMessages(
    payload: WhatsappInboundMessageDto,
  ): NormalizedInboundMessage[] {
    if (payload.from && payload.message) {
      return [
        {
          from: payload.from,
          message: payload.message,
          messageType: MessageType.TEXT,
          attachmentUrl: null,
          contactName: payload.contactName,
        },
      ];
    }

    const normalized: NormalizedInboundMessage[] = [];

    for (const entry of payload.entry ?? []) {
      const changes = Array.isArray(entry.changes)
        ? entry.changes
        : ([] as unknown[]);

      for (const change of changes) {
        if (!change || typeof change !== 'object') {
          continue;
        }

        const value =
          'value' in change && change.value && typeof change.value === 'object'
            ? (change.value as Record<string, unknown>)
            : null;

        if (!value) {
          continue;
        }

        const contacts = Array.isArray(value.contacts)
          ? value.contacts
          : ([] as unknown[]);
        const contactNameByWaId = new Map<string, string>();

        for (const contact of contacts) {
          if (!contact || typeof contact !== 'object') {
            continue;
          }

          const waId =
            'wa_id' in contact && typeof contact.wa_id === 'string'
              ? contact.wa_id
              : null;

          const profile =
            'profile' in contact &&
            contact.profile &&
            typeof contact.profile === 'object'
              ? (contact.profile as Record<string, unknown>)
              : null;

          const name =
            profile && typeof profile.name === 'string' ? profile.name : null;

          if (waId && name) {
            contactNameByWaId.set(waId, name);
          }
        }

        const messages = Array.isArray(value.messages)
          ? value.messages
          : ([] as unknown[]);

        for (const message of messages) {
          const normalizedMessage = this.normalizeProviderMessage(
            message,
            contactNameByWaId,
          );

          if (!normalizedMessage) {
            continue;
          }

          normalized.push(normalizedMessage);
        }
      }
    }

    if (normalized.length === 0) {
      throw new BadRequestException(
        'No supported inbound WhatsApp messages (text/image/document)',
      );
    }

    return normalized;
  }

  private async resolveContact(payload: NormalizedInboundMessage) {
    const existingContact = await this.contactsRepository.findOne({
      where: { whatsappId: payload.from },
    });

    if (existingContact) {
      return existingContact;
    }

    return this.contactsRepository.save(
      this.contactsRepository.create({
        fullName: payload.contactName?.trim() || payload.from,
        whatsappId: payload.from,
        phone: null,
        email: null,
        metadata: { source: 'whatsapp-webhook' },
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

  private async findOpenWhatsappSession(campaignId: string, contactId: string) {
    return this.sessionsRepository.findOne({
      where: {
        campaignId,
        contactId,
        channel: SessionChannel.WHATSAPP,
        status: In([ChatSessionStatus.PENDING, ChatSessionStatus.ACTIVE]),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  private normalizeProviderMessage(
    rawMessage: unknown,
    contactNameByWaId: Map<string, string>,
  ): NormalizedInboundMessage | null {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return null;
    }

    const from =
      'from' in rawMessage && typeof rawMessage.from === 'string'
        ? rawMessage.from
        : null;
    const type =
      'type' in rawMessage && typeof rawMessage.type === 'string'
        ? rawMessage.type
        : null;

    if (!from || !type) {
      return null;
    }

    if (type === 'text') {
      const text =
        'text' in rawMessage &&
        rawMessage.text &&
        typeof rawMessage.text === 'object'
          ? (rawMessage.text as Record<string, unknown>)
          : null;
      const textBody = text && typeof text.body === 'string' ? text.body : null;

      if (!textBody) {
        return null;
      }

      return {
        from,
        message: textBody,
        messageType: MessageType.TEXT,
        attachmentUrl: null,
        contactName: contactNameByWaId.get(from),
      };
    }

    if (type === 'image') {
      const image =
        'image' in rawMessage &&
        rawMessage.image &&
        typeof rawMessage.image === 'object'
          ? (rawMessage.image as Record<string, unknown>)
          : null;

      if (!image) {
        return null;
      }

      const caption =
        typeof image.caption === 'string' && image.caption.trim().length > 0
          ? image.caption
          : '[image]';
      const attachmentUrl =
        typeof image.link === 'string'
          ? image.link
          : typeof image.id === 'string'
            ? `whatsapp-media://${image.id}`
            : null;

      return {
        from,
        message: caption,
        messageType: MessageType.IMAGE,
        attachmentUrl,
        contactName: contactNameByWaId.get(from),
      };
    }

    if (type === 'document') {
      const document =
        'document' in rawMessage &&
        rawMessage.document &&
        typeof rawMessage.document === 'object'
          ? (rawMessage.document as Record<string, unknown>)
          : null;

      if (!document) {
        return null;
      }

      const fileLabel =
        typeof document.filename === 'string' &&
        document.filename.trim().length > 0
          ? document.filename
          : 'document';
      const caption =
        typeof document.caption === 'string' &&
        document.caption.trim().length > 0
          ? document.caption
          : `[file] ${fileLabel}`;
      const attachmentUrl =
        typeof document.link === 'string'
          ? document.link
          : typeof document.id === 'string'
            ? `whatsapp-media://${document.id}`
            : null;

      return {
        from,
        message: caption,
        messageType: MessageType.FILE,
        attachmentUrl,
        contactName: contactNameByWaId.get(from),
      };
    }

    return null;
  }

  private async resolveCampaign(payload: WhatsappInboundMessageDto) {
    const resolvedCampaignId =
      payload.campaignId ??
      this.resolveCampaignIdFromPhoneNumberMap(
        this.extractPhoneNumberIds(payload),
      );

    if (!resolvedCampaignId) {
      throw new BadRequestException(
        'campaignId is required when phone_number_id mapping is not configured',
      );
    }

    const campaign = await this.campaignsRepository.findOne({
      where: { id: resolvedCampaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.channel !== CampaignChannel.WHATSAPP) {
      throw new ForbiddenException('Campaign channel must be whatsapp');
    }

    return campaign;
  }

  private extractPhoneNumberIds(payload: WhatsappInboundMessageDto) {
    const phoneNumberIds = new Set<string>();

    if (payload.phoneNumberId) {
      phoneNumberIds.add(payload.phoneNumberId);
    }

    for (const entry of payload.entry ?? []) {
      const changes = Array.isArray(entry.changes)
        ? entry.changes
        : ([] as unknown[]);

      for (const change of changes) {
        if (!change || typeof change !== 'object') {
          continue;
        }

        const value =
          'value' in change && change.value && typeof change.value === 'object'
            ? (change.value as Record<string, unknown>)
            : null;

        if (!value || !value.metadata || typeof value.metadata !== 'object') {
          continue;
        }

        const metadata = value.metadata as Record<string, unknown>;
        if (typeof metadata.phone_number_id === 'string') {
          phoneNumberIds.add(metadata.phone_number_id);
        }
      }
    }

    return Array.from(phoneNumberIds);
  }

  private resolveCampaignIdFromPhoneNumberMap(phoneNumberIds: string[]) {
    if (phoneNumberIds.length === 0) {
      return null;
    }

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

    for (const phoneNumberId of phoneNumberIds) {
      const campaignId = parsedMap[phoneNumberId];
      if (campaignId) {
        return campaignId;
      }
    }

    return null;
  }
}
