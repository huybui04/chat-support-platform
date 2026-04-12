import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CampaignAgent } from './campaign-agent.entity';
import { Campaign } from './campaign.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatSession } from './chat-session.entity';
import { CsvImportLog } from './csv-import-log.entity';
import { TeamMember } from './team-member.entity';
import { Team } from './team.entity';

export enum UserRole {
  SUPERVISOR = 'supervisor',
  AGENT = 'agent',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'keycloak_id', type: 'varchar', length: 255, unique: true })
  keycloakId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => Team, (team) => team.createdBy)
  createdTeams: Team[];

  @OneToMany(() => TeamMember, (teamMember) => teamMember.user)
  teamMemberships: TeamMember[];

  @OneToMany(() => Campaign, (campaign) => campaign.createdBy)
  createdCampaigns: Campaign[];

  @OneToMany(() => CampaignAgent, (campaignAgent) => campaignAgent.agent)
  campaignAssignments: CampaignAgent[];

  @OneToMany(() => ChatSession, (session) => session.agent)
  assignedSessions: ChatSession[];

  @OneToMany(() => ChatMessage, (message) => message.sender)
  sentMessages: ChatMessage[];

  @OneToMany(() => CsvImportLog, (log) => log.importedBy)
  importedLogs: CsvImportLog[];
}
