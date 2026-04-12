import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Campaign,
  CampaignContact,
  ChatMessage,
  ChatSession,
  User,
} from '../../database/entities';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignContact,
      ChatSession,
      ChatMessage,
      User,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
