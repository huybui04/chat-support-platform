import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Campaign } from './campaign.entity';

export enum ExternalChannel {
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  MESSENGER = 'messenger',
}

@Entity({ name: 'channel_campaign_mappings' })
@Index('idx_channel_campaign_mappings_lookup', [
  'channel',
  'externalAccountId',
  'isActive',
  'priority',
])
@Index('idx_channel_campaign_mappings_campaign_id', ['campaignId'])
@Index('uq_channel_campaign_mappings_unique_link', [
  'channel',
  'externalAccountId',
  'campaignId',
], { unique: true })
export class ChannelCampaignMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ExternalChannel,
  })
  channel: ExternalChannel;

  @Column({ name: 'external_account_id', type: 'varchar', length: 150 })
  externalAccountId: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;
}
