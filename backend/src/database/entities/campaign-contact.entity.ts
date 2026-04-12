import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Campaign } from './campaign.entity';
import { Contact } from './contact.entity';

export enum CampaignContactStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ name: 'campaign_contacts' })
@Unique('uq_campaign_contacts_campaign_id_contact_id', [
  'campaignId',
  'contactId',
])
export class CampaignContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId: string;

  @Column({
    type: 'enum',
    enum: CampaignContactStatus,
    default: CampaignContactStatus.PENDING,
  })
  status: CampaignContactStatus;

  @Column({
    name: 'import_batch',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  importBatch: string | null;

  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  @ManyToOne(() => Campaign, (campaign) => campaign.contactLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => Contact, (contact) => contact.campaignLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;
}
