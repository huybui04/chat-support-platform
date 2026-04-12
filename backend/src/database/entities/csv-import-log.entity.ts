import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Campaign } from './campaign.entity';
import { User } from './user.entity';

export enum CsvImportStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ name: 'csv_import_logs' })
export class CsvImportLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'total_rows', type: 'integer', default: 0 })
  totalRows: number;

  @Column({ name: 'success_rows', type: 'integer', default: 0 })
  successRows: number;

  @Column({ name: 'failed_rows', type: 'integer', default: 0 })
  failedRows: number;

  @Column({ type: 'enum', enum: CsvImportStatus })
  status: CsvImportStatus;

  @Column({ name: 'error_log', type: 'jsonb', nullable: true })
  errorLog: Record<string, unknown> | null;

  @Column({ name: 'imported_by', type: 'uuid' })
  importedById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Campaign, (campaign) => campaign.importLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @ManyToOne(() => User, (user) => user.importedLogs, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'imported_by' })
  importedBy: User;
}
