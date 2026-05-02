import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRfcMessageId1777733885064 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS rfc_message_id varchar(500)`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE chat_messages DROP COLUMN IF EXISTS rfc_message_id`
        );
    }

}
