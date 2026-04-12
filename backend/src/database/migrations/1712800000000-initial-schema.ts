import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1712800000000 implements MigrationInterface {
  name = 'InitialSchema1712800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(
      "CREATE TYPE users_role_enum AS ENUM ('supervisor', 'agent')",
    );
    await queryRunner.query(
      "CREATE TYPE campaigns_status_enum AS ENUM ('draft', 'active', 'paused', 'completed')",
    );
    await queryRunner.query(
      "CREATE TYPE campaigns_channel_enum AS ENUM ('web', 'whatsapp')",
    );
    await queryRunner.query(
      "CREATE TYPE campaign_contacts_status_enum AS ENUM ('pending', 'assigned', 'completed', 'failed')",
    );
    await queryRunner.query(
      "CREATE TYPE chat_sessions_channel_enum AS ENUM ('web', 'whatsapp')",
    );
    await queryRunner.query(
      "CREATE TYPE chat_sessions_status_enum AS ENUM ('pending', 'active', 'completed', 'abandoned')",
    );
    await queryRunner.query(
      "CREATE TYPE chat_messages_sender_type_enum AS ENUM ('agent', 'customer', 'system')",
    );
    await queryRunner.query(
      "CREATE TYPE chat_messages_message_type_enum AS ENUM ('text', 'image', 'file', 'system')",
    );
    await queryRunner.query(
      "CREATE TYPE csv_import_logs_status_enum AS ENUM ('processing', 'completed', 'failed')",
    );

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        keycloak_id varchar(255) NOT NULL UNIQUE,
        email varchar(255) NOT NULL UNIQUE,
        full_name varchar(255) NOT NULL,
        role users_role_enum NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        is_online boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE teams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        description text,
        created_by uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_teams_created_by FOREIGN KEY (created_by)
          REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE team_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id uuid NOT NULL,
        user_id uuid NOT NULL,
        joined_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_team_members_team_id_user_id UNIQUE (team_id, user_id),
        CONSTRAINT fk_team_members_team_id FOREIGN KEY (team_id)
          REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT fk_team_members_user_id FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE campaigns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        description text,
        status campaigns_status_enum NOT NULL DEFAULT 'draft',
        channel campaigns_channel_enum NOT NULL DEFAULT 'web',
        start_date date,
        end_date date,
        created_by uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_campaigns_created_by FOREIGN KEY (created_by)
          REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE campaign_teams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL,
        team_id uuid NOT NULL,
        CONSTRAINT uq_campaign_teams_campaign_id_team_id UNIQUE (campaign_id, team_id),
        CONSTRAINT fk_campaign_teams_campaign_id FOREIGN KEY (campaign_id)
          REFERENCES campaigns(id) ON DELETE CASCADE,
        CONSTRAINT fk_campaign_teams_team_id FOREIGN KEY (team_id)
          REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE campaign_agents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL,
        agent_id uuid NOT NULL,
        assigned_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_campaign_agents_campaign_id_agent_id UNIQUE (campaign_id, agent_id),
        CONSTRAINT fk_campaign_agents_campaign_id FOREIGN KEY (campaign_id)
          REFERENCES campaigns(id) ON DELETE CASCADE,
        CONSTRAINT fk_campaign_agents_agent_id FOREIGN KEY (agent_id)
          REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name varchar(255) NOT NULL,
        phone varchar(50),
        email varchar(255),
        whatsapp_id varchar(100),
        metadata jsonb,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE campaign_contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL,
        contact_id uuid NOT NULL,
        status campaign_contacts_status_enum NOT NULL DEFAULT 'pending',
        import_batch varchar(100),
        assigned_at timestamp,
        CONSTRAINT uq_campaign_contacts_campaign_id_contact_id UNIQUE (campaign_id, contact_id),
        CONSTRAINT fk_campaign_contacts_campaign_id FOREIGN KEY (campaign_id)
          REFERENCES campaigns(id) ON DELETE CASCADE,
        CONSTRAINT fk_campaign_contacts_contact_id FOREIGN KEY (contact_id)
          REFERENCES contacts(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE chat_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL,
        contact_id uuid NOT NULL,
        agent_id uuid,
        channel chat_sessions_channel_enum NOT NULL,
        status chat_sessions_status_enum NOT NULL DEFAULT 'pending',
        started_at timestamp,
        ended_at timestamp,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_chat_sessions_campaign_id FOREIGN KEY (campaign_id)
          REFERENCES campaigns(id) ON DELETE RESTRICT,
        CONSTRAINT fk_chat_sessions_contact_id FOREIGN KEY (contact_id)
          REFERENCES contacts(id) ON DELETE RESTRICT,
        CONSTRAINT fk_chat_sessions_agent_id FOREIGN KEY (agent_id)
          REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL,
        sender_type chat_messages_sender_type_enum NOT NULL,
        sender_id uuid,
        content text NOT NULL,
        message_type chat_messages_message_type_enum NOT NULL DEFAULT 'text',
        attachment_url varchar(500),
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_chat_messages_session_id FOREIGN KEY (session_id)
          REFERENCES chat_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_messages_sender_id FOREIGN KEY (sender_id)
          REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE csv_import_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL,
        file_name varchar(255) NOT NULL,
        total_rows integer NOT NULL DEFAULT 0,
        success_rows integer NOT NULL DEFAULT 0,
        failed_rows integer NOT NULL DEFAULT 0,
        status csv_import_logs_status_enum NOT NULL,
        error_log jsonb,
        imported_by uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_csv_import_logs_campaign_id FOREIGN KEY (campaign_id)
          REFERENCES campaigns(id) ON DELETE CASCADE,
        CONSTRAINT fk_csv_import_logs_imported_by FOREIGN KEY (imported_by)
          REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      'CREATE INDEX idx_sessions_agent_id ON chat_sessions(agent_id)',
    );
    await queryRunner.query(
      'CREATE INDEX idx_sessions_status ON chat_sessions(status)',
    );
    await queryRunner.query(
      'CREATE INDEX idx_messages_session_id ON chat_messages(session_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_messages_session_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_sessions_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_sessions_agent_id');

    await queryRunner.query('DROP TABLE IF EXISTS csv_import_logs');
    await queryRunner.query('DROP TABLE IF EXISTS chat_messages');
    await queryRunner.query('DROP TABLE IF EXISTS chat_sessions');
    await queryRunner.query('DROP TABLE IF EXISTS campaign_contacts');
    await queryRunner.query('DROP TABLE IF EXISTS contacts');
    await queryRunner.query('DROP TABLE IF EXISTS campaign_agents');
    await queryRunner.query('DROP TABLE IF EXISTS campaign_teams');
    await queryRunner.query('DROP TABLE IF EXISTS campaigns');
    await queryRunner.query('DROP TABLE IF EXISTS team_members');
    await queryRunner.query('DROP TABLE IF EXISTS teams');
    await queryRunner.query('DROP TABLE IF EXISTS users');

    await queryRunner.query('DROP TYPE IF EXISTS csv_import_logs_status_enum');
    await queryRunner.query(
      'DROP TYPE IF EXISTS chat_messages_message_type_enum',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS chat_messages_sender_type_enum',
    );
    await queryRunner.query('DROP TYPE IF EXISTS chat_sessions_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS chat_sessions_channel_enum');
    await queryRunner.query(
      'DROP TYPE IF EXISTS campaign_contacts_status_enum',
    );
    await queryRunner.query('DROP TYPE IF EXISTS campaigns_channel_enum');
    await queryRunner.query('DROP TYPE IF EXISTS campaigns_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS users_role_enum');
  }
}
