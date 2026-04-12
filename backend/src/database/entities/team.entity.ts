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

import { CampaignTeam } from './campaign-team.entity';
import { TeamMember } from './team-member.entity';
import { User } from './user.entity';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.createdTeams, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @OneToMany(() => TeamMember, (teamMember) => teamMember.team)
  members!: TeamMember[];

  @OneToMany(() => CampaignTeam, (campaignTeam) => campaignTeam.team)
  campaignLinks!: CampaignTeam[];
}
