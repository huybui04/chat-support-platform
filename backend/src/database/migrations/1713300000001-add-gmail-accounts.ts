import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGmailAccounts1713300000001 implements MigrationInterface {
  name = 'AddGmailAccounts1713300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE gmail_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        refresh_token text NOT NULL,
        access_token text,
        access_token_expires_at timestamp,
        history_id varchar(50),
        watch_expiration timestamp,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_gmail_accounts_email UNIQUE (email)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS gmail_accounts');
  }
}
