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
export class MessengerInboundAdapter
  implements InboundProviderAdapter<unknown>
{
  readonly channel = ExternalChannel.MESSENGER;

  normalizeInboundMessages(payload: unknown): NormalizedInboundMessage[] {
    const root = asRecord(payload);
    const entries = Array.isArray(root?.entry) ? root.entry : [];
    const normalized: NormalizedInboundMessage[] = [];

    for (const entry of entries) {
      const entryRecord = asRecord(entry);
      if (!entryRecord) {
        continue;
      }

      const messagingEvents = Array.isArray(entryRecord.messaging)
        ? entryRecord.messaging
        : [];

      for (const event of messagingEvents) {
        const eventRecord = asRecord(event);
        if (!eventRecord) {
          continue;
        }

        const sender = asRecord(eventRecord.sender);
        const senderId = typeof sender?.id === 'string' ? sender.id : null;
        if (!senderId) {
          continue;
        }

        const message = asRecord(eventRecord.message);
        if (!message) {
          continue;
        }

        if (typeof message.text === 'string' && message.text.trim().length > 0) {
          normalized.push({
            from: senderId,
            message: message.text,
            messageType: MessageType.TEXT,
            attachmentUrl: null,
          });
          continue;
        }

        const attachments = Array.isArray(message.attachments)
          ? message.attachments
          : [];
        const firstAttachment = asRecord(attachments[0]);
        const attachmentType =
          typeof firstAttachment?.type === 'string'
            ? firstAttachment.type
            : null;
        const attachmentPayload = asRecord(firstAttachment?.payload);
        const attachmentUrl =
          attachmentPayload && typeof attachmentPayload.url === 'string'
            ? attachmentPayload.url
            : null;

        if (attachmentType === 'image') {
          normalized.push({
            from: senderId,
            message: '[image]',
            messageType: MessageType.IMAGE,
            attachmentUrl,
          });
          continue;
        }

        if (attachmentType) {
          normalized.push({
            from: senderId,
            message: `[file] ${attachmentType}`,
            messageType: MessageType.FILE,
            attachmentUrl,
          });
        }
      }
    }

    if (normalized.length === 0) {
      throw new BadRequestException('No supported inbound Messenger messages');
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
}
