import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannelCampaignMappings1713000000000 implements MigrationInterface {
  name = 'AddChannelCampaignMappings1713000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TYPE channel_campaign_mappings_channel_enum AS ENUM ('whatsapp', 'instagram', 'messenger')",
    );

    await queryRunner.query(`
      CREATE TABLE channel_campaign_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        channel channel_campaign_mappings_channel_enum NOT NULL,
        external_account_id varchar(150) NOT NULL,
        campaign_id uuid NOT NULL,
        priority integer NOT NULL DEFAULT 1,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_channel_campaign_mappings_campaign_id FOREIGN KEY (campaign_id)
          REFERENCES campaigns(id) ON DELETE CASCADE,
        CONSTRAINT uq_channel_campaign_mappings_unique_link UNIQUE (channel, external_account_id, campaign_id)
      )
    `);

    await queryRunner.query(
      'CREATE INDEX idx_channel_campaign_mappings_lookup ON channel_campaign_mappings(channel, external_account_id, is_active, priority)',
    );
    await queryRunner.query(
      'CREATE INDEX idx_channel_campaign_mappings_campaign_id ON channel_campaign_mappings(campaign_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_channel_campaign_mappings_campaign_id',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_channel_campaign_mappings_lookup',
    );
    await queryRunner.query('DROP TABLE IF EXISTS channel_campaign_mappings');
    await queryRunner.query(
      'DROP TYPE IF EXISTS channel_campaign_mappings_channel_enum',
    );
  }
}
