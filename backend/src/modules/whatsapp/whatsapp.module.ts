import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Campaign,
  CampaignContact,
  ChatMessage,
  ChatSession,
  Contact,
} from '../../database/entities';
import { ChatModule } from '../chat/chat.module';
import { SessionsModule } from '../sessions/sessions.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      Contact,
      CampaignContact,
      ChatSession,
      ChatMessage,
    ]),
    SessionsModule,
    ChatModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
