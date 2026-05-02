import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGmailReplyFields1713400000000 implements MigrationInterface {
  name = 'AddGmailReplyFields1713400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_messages ADD COLUMN external_message_id varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_messages ADD COLUMN external_thread_id varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_messages DROP COLUMN IF EXISTS external_thread_id`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_messages DROP COLUMN IF EXISTS external_message_id`,
    );
  }
}
