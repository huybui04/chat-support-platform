import { ExternalChannel, MessageType } from '../../../database/entities';

export type NormalizedInboundMessage = {
  from: string;
  message: string;
  messageType: MessageType;
  attachmentUrl: string | null;
  contactName?: string;
};

export interface InboundProviderAdapter<TPayload = unknown> {
  readonly channel: ExternalChannel;
  normalizeInboundMessages(payload: TPayload): NormalizedInboundMessage[];
  extractExternalAccountIds(payload: TPayload): string[];
}
