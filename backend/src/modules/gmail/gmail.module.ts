import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Campaign,
  CampaignAgent,
  CampaignContact,
  ChannelCampaignMapping,
  ChatMessage,
  ChatSession,
  Contact,
  GmailAccount,
  User,
} from '../../database/entities';
import { ChatModule } from '../chat/chat.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AiModule } from '../ai/ai.module';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GmailAccount,
      Campaign,
      Contact,
      CampaignContact,
      ChatSession,
      ChatMessage,
      CampaignAgent,
      ChannelCampaignMapping,
      User,
    ]),
    forwardRef(() => SessionsModule),
    forwardRef(() => ChatModule),
    AiModule,
  ],
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
