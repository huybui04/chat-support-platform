import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gmail_accounts' })
@Index('uq_gmail_accounts_email', ['email'], { unique: true })
export class GmailAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({
    name: 'access_token_expires_at',
    type: 'timestamp',
    nullable: true,
  })
  accessTokenExpiresAt: Date | null;

  @Column({ name: 'history_id', type: 'varchar', length: 50, nullable: true })
  historyId: string | null;

  @Column({ name: 'watch_expiration', type: 'timestamp', nullable: true })
  watchExpiration: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
