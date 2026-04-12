import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Campaign } from './campaign.entity';
import { User } from './user.entity';

@Entity({ name: 'campaign_agents' })
@Unique('uq_campaign_agents_campaign_id_agent_id', ['campaignId', 'agentId'])
export class CampaignAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamp' })
  assignedAt: Date;

  @ManyToOne(() => Campaign, (campaign) => campaign.agentLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => User, (user) => user.campaignAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'agent_id' })
  agent: User;
}
