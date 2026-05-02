import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMessageSubject1777695726478 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS subject varchar(500)`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE chat_messages DROP COLUMN IF EXISTS subject`
        );
    }

}
