import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ExternalChannel } from '../../../database/entities';
import { WhatsappInboundAdapter } from '../whatsapp-inbound.adapter';
import { InstagramInboundAdapter } from './instagram-inbound.adapter';
import {
  InboundProviderAdapter,
  NormalizedInboundMessage,
} from './inbound-provider.adapter';
import { MessengerInboundAdapter } from './messenger-inbound.adapter';

@Injectable()
export class MetaInboundAdapterRegistry {
  private readonly adapterByChannel: Map<
    ExternalChannel,
    InboundProviderAdapter<unknown>
  >;

  constructor(
    whatsappInboundAdapter: WhatsappInboundAdapter,
    instagramInboundAdapter: InstagramInboundAdapter,
    messengerInboundAdapter: MessengerInboundAdapter,
  ) {
    const adapters: InboundProviderAdapter<unknown>[] = [
      whatsappInboundAdapter,
      instagramInboundAdapter,
      messengerInboundAdapter,
    ];

    this.adapterByChannel = new Map<
      ExternalChannel,
      InboundProviderAdapter<unknown>
    >();

    for (const adapter of adapters) {
      if (this.adapterByChannel.has(adapter.channel)) {
        throw new InternalServerErrorException(
          `Duplicate inbound adapter registration for channel: ${adapter.channel}`,
        );
      }

      this.adapterByChannel.set(adapter.channel, adapter);
    }
  }

  getAdapter(channel: ExternalChannel): InboundProviderAdapter<unknown> {
    const adapter = this.adapterByChannel.get(channel);
    if (!adapter) {
      const supportedChannels = Array.from(this.adapterByChannel.keys()).join(
        ', ',
      );
      throw new NotFoundException(
        `No inbound adapter configured for channel: ${channel}. Supported channels: ${supportedChannels}`,
      );
    }

    return adapter;
  }

  normalizeInboundMessages(
    channel: ExternalChannel,
    payload: unknown,
  ): NormalizedInboundMessage[] {
    const adapter = this.getAdapter(channel);
    return adapter.normalizeInboundMessages(payload);
  }

  extractExternalAccountIds(
    channel: ExternalChannel,
    payload: unknown,
  ): string[] {
    const adapter = this.getAdapter(channel);
    return adapter.extractExternalAccountIds(payload);
  }
}
