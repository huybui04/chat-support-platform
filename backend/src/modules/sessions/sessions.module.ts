import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Campaign,
  CampaignContact,
  ChatMessage,
  ChatSession,
  User,
} from '../../database/entities';
import { ChatModule } from '../chat/chat.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      ChatSession,
      ChatMessage,
      User,
      CampaignContact,
    ]),
    ChatModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
