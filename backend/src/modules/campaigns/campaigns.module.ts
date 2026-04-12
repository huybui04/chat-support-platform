import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Campaign,
  CampaignAgent,
  CampaignContact,
  CampaignTeam,
  ChatSession,
  Contact,
  CsvImportLog,
  Team,
  User,
} from '../../database/entities';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignAgent,
      CampaignTeam,
      CampaignContact,
      ChatSession,
      Contact,
      CsvImportLog,
      User,
      Team,
    ]),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
