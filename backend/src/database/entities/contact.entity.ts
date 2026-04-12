import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CampaignContact } from './campaign-contact.entity';
import { ChatSession } from './chat-session.entity';

@Entity({ name: 'contacts' })
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'whatsapp_id', type: 'varchar', length: 100, nullable: true })
  whatsappId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(
    () => CampaignContact,
    (campaignContact) => campaignContact.contact,
  )
  campaignLinks: CampaignContact[];

  @OneToMany(() => ChatSession, (session) => session.contact)
  sessions: ChatSession[];
}
