import { BadRequestException, Injectable } from '@nestjs/common';

import { ExternalChannel, MessageType } from '../../../database/entities';
import {
  InboundProviderAdapter,
  NormalizedInboundMessage,
} from './inbound-provider.adapter';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

@Injectable()
export class InstagramInboundAdapter
  implements InboundProviderAdapter<unknown>
{
  readonly channel = ExternalChannel.INSTAGRAM;

  normalizeInboundMessages(payload: unknown): NormalizedInboundMessage[] {
    const root = asRecord(payload);
    const entryList = Array.isArray(root?.entry) ? root.entry : [];
    const normalized: NormalizedInboundMessage[] = [];

    for (const entry of entryList) {
      const entryRecord = asRecord(entry);
      if (!entryRecord) {
        continue;
      }

      const changes = Array.isArray(entryRecord.changes)
        ? entryRecord.changes
        : [];

      for (const change of changes) {
        const changeRecord = asRecord(change);
        const value = asRecord(changeRecord?.value);
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
        const messages = Array.isArray(value?.messages) ? value.messages : [];

        const contactNameById = new Map<string, string>();
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
            contactNameById.set(waId, name);
          }
        }

        for (const message of messages) {
          const normalizedMessage = this.normalizeMetaMessage(
            message,
            contactNameById,
          );
          if (normalizedMessage) {
            normalized.push(normalizedMessage);
          }
        }
      }
    }

    if (normalized.length === 0) {
      throw new BadRequestException('No supported inbound Instagram messages');
    }

    return normalized;
  }

  extractExternalAccountIds(payload: unknown): string[] {
    const root = asRecord(payload);
    const ids = new Set<string>();

    if (typeof root?.externalAccountId === 'string') {
      ids.add(root.externalAccountId);
    }

    const entries = Array.isArray(root?.entry) ? root.entry : [];
    for (const entry of entries) {
      const entryRecord = asRecord(entry);
      if (!entryRecord) {
        continue;
      }

      if (typeof entryRecord.id === 'string') {
        ids.add(entryRecord.id);
      }
    }

    return Array.from(ids);
  }

  private normalizeMetaMessage(
    rawMessage: unknown,
    contactNameById: Map<string, string>,
  ): NormalizedInboundMessage | null {
    const messageRecord = asRecord(rawMessage);
    if (!messageRecord) {
      return null;
    }

    const from =
      typeof messageRecord.from === 'string' ? messageRecord.from : null;
    const type =
      typeof messageRecord.type === 'string' ? messageRecord.type : null;

    if (!from || !type) {
      return null;
    }

    if (type === 'text') {
      const text = asRecord(messageRecord.text);
      const textBody = text && typeof text.body === 'string' ? text.body : null;
      if (!textBody) {
        return null;
      }

      return {
        from,
        message: textBody,
        messageType: MessageType.TEXT,
        attachmentUrl: null,
        contactName: contactNameById.get(from),
      };
    }

    if (type === 'image') {
      const image = asRecord(messageRecord.image);
      if (!image) {
        return null;
      }

      return {
        from,
        message:
          typeof image.caption === 'string' && image.caption.trim().length > 0
            ? image.caption
            : '[image]',
        messageType: MessageType.IMAGE,
        attachmentUrl:
          typeof image.link === 'string'
            ? image.link
            : typeof image.id === 'string'
              ? `instagram-media://${image.id}`
              : null,
        contactName: contactNameById.get(from),
      };
    }

    if (type === 'document') {
      const document = asRecord(messageRecord.document);
      if (!document) {
        return null;
      }

      const fileLabel =
        typeof document.filename === 'string' && document.filename.trim().length > 0
          ? document.filename
          : 'document';

      return {
        from,
        message:
          typeof document.caption === 'string' &&
          document.caption.trim().length > 0
            ? document.caption
            : `[file] ${fileLabel}`,
        messageType: MessageType.FILE,
        attachmentUrl:
          typeof document.link === 'string'
            ? document.link
            : typeof document.id === 'string'
              ? `instagram-media://${document.id}`
              : null,
        contactName: contactNameById.get(from),
      };
    }

    return null;
  }
}
