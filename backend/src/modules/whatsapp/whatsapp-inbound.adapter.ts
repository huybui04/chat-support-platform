import { BadRequestException, Injectable } from '@nestjs/common';

import { ExternalChannel, MessageType } from '../../database/entities';
import type {
  InboundProviderAdapter,
  NormalizedInboundMessage,
} from './adapters/inbound-provider.adapter';
import { WhatsappInboundMessageDto } from './dto/whatsapp-inbound-message.dto';

export type { NormalizedInboundMessage } from './adapters/inbound-provider.adapter';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

@Injectable()
export class WhatsappInboundAdapter implements InboundProviderAdapter<WhatsappInboundMessageDto> {
  readonly channel = ExternalChannel.WHATSAPP;

  normalizeInboundMessages(
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
        const changeRecord = asRecord(change);
        if (!changeRecord) {
          continue;
        }

        const value = asRecord(changeRecord.value);

        if (!value) {
          continue;
        }

        const contacts = Array.isArray(value.contacts)
          ? value.contacts
          : ([] as unknown[]);
        const contactNameByWaId = new Map<string, string>();

        for (const contact of contacts) {
          const contactRecord = asRecord(contact);
          if (!contactRecord) {
            continue;
          }

          const waId =
            typeof contactRecord.wa_id === 'string'
              ? contactRecord.wa_id
              : null;

          const profile = asRecord(contactRecord.profile);

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

  extractPhoneNumberIds(payload: WhatsappInboundMessageDto) {
    const phoneNumberIds = new Set<string>();

    if (payload.phoneNumberId) {
      phoneNumberIds.add(payload.phoneNumberId);
    }

    for (const entry of payload.entry ?? []) {
      const changes = Array.isArray(entry.changes)
        ? entry.changes
        : ([] as unknown[]);

      for (const change of changes) {
        const changeRecord = asRecord(change);
        if (!changeRecord) {
          continue;
        }

        const value = asRecord(changeRecord.value);

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

  extractExternalAccountIds(payload: WhatsappInboundMessageDto) {
    return this.extractPhoneNumberIds(payload);
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
}
