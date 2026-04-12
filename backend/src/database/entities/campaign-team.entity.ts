import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Campaign } from './campaign.entity';
import { Team } from './team.entity';

@Entity({ name: 'campaign_teams' })
@Unique('uq_campaign_teams_campaign_id_team_id', ['campaignId', 'teamId'])
export class CampaignTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.teamLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => Team, (team) => team.campaignLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;
}
