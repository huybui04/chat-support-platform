import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Campaign, ChannelCampaignMapping } from '../../database/entities';
import { ChannelMappingsController } from './channel-mappings.controller';
import { ChannelMappingsService } from './channel-mappings.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChannelCampaignMapping, Campaign])],
  controllers: [ChannelMappingsController],
  providers: [ChannelMappingsService],
})
export class ChannelMappingsModule {}
