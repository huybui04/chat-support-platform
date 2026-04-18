import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendChannelEnums1713100000000 implements MigrationInterface {
  name = 'ExtendChannelEnums1713100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TYPE campaigns_channel_enum ADD VALUE IF NOT EXISTS 'instagram'",
    );
    await queryRunner.query(
      "ALTER TYPE campaigns_channel_enum ADD VALUE IF NOT EXISTS 'messenger'",
    );

    await queryRunner.query(
      "ALTER TYPE chat_sessions_channel_enum ADD VALUE IF NOT EXISTS 'instagram'",
    );
    await queryRunner.query(
      "ALTER TYPE chat_sessions_channel_enum ADD VALUE IF NOT EXISTS 'messenger'",
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enum values cannot be safely removed in a backward migration
    // without recreating dependent types/tables.
  }
}
