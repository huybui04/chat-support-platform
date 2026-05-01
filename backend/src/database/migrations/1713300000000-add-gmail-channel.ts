import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGmailChannel1713300000000 implements MigrationInterface {
  name = 'AddGmailChannel1713300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TYPE campaigns_channel_enum ADD VALUE IF NOT EXISTS 'gmail'",
    );
    await queryRunner.query(
      "ALTER TYPE chat_sessions_channel_enum ADD VALUE IF NOT EXISTS 'gmail'",
    );
    await queryRunner.query(
      "ALTER TYPE channel_campaign_mappings_channel_enum ADD VALUE IF NOT EXISTS 'gmail'",
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enum values cannot be safely removed in a backward migration.
  }
}
