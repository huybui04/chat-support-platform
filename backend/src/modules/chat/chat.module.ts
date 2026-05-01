import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Campaign,
  ChannelCampaignMapping,
  ChatMessage,
  ChatSession,
} from '../../database/entities';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatSession,
      ChatMessage,
      Campaign,
      ChannelCampaignMapping,
    ]),
    forwardRef(() => GmailModule),
  ],
  providers: [ChatGateway, ChatService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
