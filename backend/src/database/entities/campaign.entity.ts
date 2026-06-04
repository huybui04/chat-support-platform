import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CampaignAgent } from './campaign-agent.entity';
import { CampaignContact } from './campaign-contact.entity';
import { CampaignTeam } from './campaign-team.entity';
import { ChatSession } from './chat-session.entity';
import { CsvImportLog } from './csv-import-log.entity';
import { User } from './user.entity';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export enum CampaignChannel {
  WEB = 'web',
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  MESSENGER = 'messenger',
  GMAIL = 'gmail',
}

export enum CampaignType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

@Entity({ name: 'campaigns' })
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  @Column({
    type: 'enum',
    enum: CampaignChannel,
    default: CampaignChannel.WEB,
  })
  channel: CampaignChannel;

  @Column({
    type: 'enum',
    enum: CampaignType,
    default: CampaignType.OUTBOUND,
  })
  type: CampaignType;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 255, default: 'chat-support-platform' })
  tenantId: string;


  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.createdCampaigns, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => CampaignTeam, (campaignTeam) => campaignTeam.campaign)
  teamLinks: CampaignTeam[];

  @OneToMany(() => CampaignAgent, (campaignAgent) => campaignAgent.campaign)
  agentLinks: CampaignAgent[];

  @OneToMany(
    () => CampaignContact,
    (campaignContact) => campaignContact.campaign,
  )
  contactLinks: CampaignContact[];

  @OneToMany(() => ChatSession, (session) => session.campaign)
  sessions: ChatSession[];

  @OneToMany(() => CsvImportLog, (log) => log.campaign)
  importLogs: CsvImportLog[];
}
