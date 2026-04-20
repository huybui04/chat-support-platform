import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Campaign,
  CampaignAgent,
  ChannelCampaignMapping,
  CampaignContact,
  ChatMessage,
  ChatSession,
  Contact,
  User,
} from '../../database/entities';
import { ChatModule } from '../chat/chat.module';
import { SessionsModule } from '../sessions/sessions.module';
import { InstagramInboundAdapter } from './adapters/instagram-inbound.adapter';
import { MessengerInboundAdapter } from './adapters/messenger-inbound.adapter';
import { MetaInboundAdapterRegistry } from './adapters/meta-inbound-adapter.registry';
import { WhatsappInboundAdapter } from './whatsapp-inbound.adapter';
import {
  MetaWebhookAliasController,
  WhatsappController,
} from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignAgent,
      ChannelCampaignMapping,
      Contact,
      CampaignContact,
      ChatSession,
      ChatMessage,
      User,
    ]),
    SessionsModule,
    ChatModule,
  ],
  controllers: [WhatsappController, MetaWebhookAliasController],
  providers: [
    WhatsappService,
    WhatsappInboundAdapter,
    InstagramInboundAdapter,
    MessengerInboundAdapter,
    MetaInboundAdapterRegistry,
  ],
})
export class WhatsappModule {}
