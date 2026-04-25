import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignType1713200000000 implements MigrationInterface {
  name = 'AddCampaignType1713200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TYPE campaigns_type_enum AS ENUM ('inbound', 'outbound')",
    );

    await queryRunner.query(
      "ALTER TABLE campaigns ADD COLUMN type campaigns_type_enum NOT NULL DEFAULT 'outbound'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE campaigns DROP COLUMN IF EXISTS type');
    await queryRunner.query('DROP TYPE IF EXISTS campaigns_type_enum');
  }
}
