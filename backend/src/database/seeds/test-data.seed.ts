import 'dotenv/config';

import dataSource from '../data-source';
import { CampaignAgent } from '../entities/campaign-agent.entity';
import {
  Campaign,
  CampaignChannel,
  CampaignStatus,
} from '../entities/campaign.entity';
import {
  CampaignContact,
  CampaignContactStatus,
} from '../entities/campaign-contact.entity';
import { CampaignTeam } from '../entities/campaign-team.entity';
import {
  ChatMessage,
  MessageSenderType,
  MessageType,
} from '../entities/chat-message.entity';
import {
  ChatSession,
  ChatSessionStatus,
  SessionChannel,
} from '../entities/chat-session.entity';
import { Contact } from '../entities/contact.entity';
import {
  CsvImportLog,
  CsvImportStatus,
} from '../entities/csv-import-log.entity';
import { TeamMember } from '../entities/team-member.entity';
import { Team } from '../entities/team.entity';
import { User, UserRole } from '../entities/user.entity';

const TABLES_TO_TRUNCATE = [
  'chat_messages',
  'chat_sessions',
  'campaign_contacts',
  'contacts',
  'campaign_agents',
  'campaign_teams',
  'csv_import_logs',
  'campaigns',
  'team_members',
  'teams',
  'users',
] as const;

async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    await dataSource.query(
      `TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(', ')} RESTART IDENTITY CASCADE`,
    );

    const userRepo = dataSource.getRepository(User);
    const teamRepo = dataSource.getRepository(Team);
    const teamMemberRepo = dataSource.getRepository(TeamMember);
    const campaignRepo = dataSource.getRepository(Campaign);
    const campaignTeamRepo = dataSource.getRepository(CampaignTeam);
    const campaignAgentRepo = dataSource.getRepository(CampaignAgent);
    const contactRepo = dataSource.getRepository(Contact);
    const campaignContactRepo = dataSource.getRepository(CampaignContact);
    const sessionRepo = dataSource.getRepository(ChatSession);
    const messageRepo = dataSource.getRepository(ChatMessage);
    const importLogRepo = dataSource.getRepository(CsvImportLog);

    const supervisor = await userRepo.save(
      userRepo.create({
        keycloakId: 'kc-supervisor-001',
        email: 'supervisor@test.local',
        fullName: 'Supervisor One',
        role: UserRole.SUPERVISOR,
        isActive: true,
        isOnline: true,
      }),
    );

    const agents = await userRepo.save([
      userRepo.create({
        keycloakId: 'kc-agent-001',
        email: 'agent.1@test.local',
        fullName: 'Agent One',
        role: UserRole.AGENT,
        isActive: true,
        isOnline: true,
      }),
      userRepo.create({
        keycloakId: 'kc-agent-002',
        email: 'agent.2@test.local',
        fullName: 'Agent Two',
        role: UserRole.AGENT,
        isActive: true,
        isOnline: false,
      }),
      userRepo.create({
        keycloakId: 'kc-agent-003',
        email: 'agent.3@test.local',
        fullName: 'Agent Three',
        role: UserRole.AGENT,
        isActive: true,
        isOnline: true,
      }),
    ]);

    const teams = await teamRepo.save([
      teamRepo.create({
        name: 'Team Alpha',
        description: 'Inbound and outbound web support team',
        createdById: supervisor.id,
      }),
      teamRepo.create({
        name: 'Team Beta',
        description: 'WhatsApp campaign support team',
        createdById: supervisor.id,
      }),
    ]);

    await teamMemberRepo.save([
      teamMemberRepo.create({
        teamId: teams[0].id,
        userId: agents[0].id,
      }),
      teamMemberRepo.create({
        teamId: teams[0].id,
        userId: agents[1].id,
      }),
      teamMemberRepo.create({
        teamId: teams[1].id,
        userId: agents[2].id,
      }),
    ]);

    const campaigns = await campaignRepo.save([
      campaignRepo.create({
        name: 'Summer Retention 2026',
        description: 'Re-engage customers inactive for 30+ days',
        status: CampaignStatus.ACTIVE,
        channel: CampaignChannel.WEB,
        startDate: '2026-04-01',
        endDate: '2026-05-31',
        createdById: supervisor.id,
      }),
      campaignRepo.create({
        name: 'WhatsApp Upsell Q2',
        description: 'Upsell premium package through WhatsApp channel',
        status: CampaignStatus.PAUSED,
        channel: CampaignChannel.WHATSAPP,
        startDate: '2026-03-15',
        endDate: '2026-06-15',
        createdById: supervisor.id,
      }),
    ]);

    await campaignTeamRepo.save([
      campaignTeamRepo.create({
        campaignId: campaigns[0].id,
        teamId: teams[0].id,
      }),
      campaignTeamRepo.create({
        campaignId: campaigns[1].id,
        teamId: teams[1].id,
      }),
    ]);

    await campaignAgentRepo.save([
      campaignAgentRepo.create({
        campaignId: campaigns[0].id,
        agentId: agents[0].id,
      }),
      campaignAgentRepo.create({
        campaignId: campaigns[0].id,
        agentId: agents[1].id,
      }),
      campaignAgentRepo.create({
        campaignId: campaigns[1].id,
        agentId: agents[2].id,
      }),
    ]);

    const contacts = await contactRepo.save([
      contactRepo.create({
        fullName: 'Nguyen Van A',
        phone: '+84901111111',
        email: 'nva@example.com',
        whatsappId: '84901111111',
        metadata: { city: 'HCM', source: 'landing-page' },
      }),
      contactRepo.create({
        fullName: 'Tran Thi B',
        phone: '+84902222222',
        email: 'ttb@example.com',
        whatsappId: '84902222222',
        metadata: { city: 'HN', source: 'facebook-ads' },
      }),
      contactRepo.create({
        fullName: 'Le Van C',
        phone: '+84903333333',
        email: 'lvc@example.com',
        whatsappId: null,
        metadata: { city: 'Da Nang', source: 'csv-import' },
      }),
      contactRepo.create({
        fullName: 'Pham Thi D',
        phone: '+84904444444',
        email: 'ptd@example.com',
        whatsappId: '84904444444',
        metadata: { city: 'Can Tho', source: 'referral' },
      }),
      contactRepo.create({
        fullName: 'Hoang Van E',
        phone: '+84905555555',
        email: 'hve@example.com',
        whatsappId: null,
        metadata: { city: 'Hue', source: 'web-chat' },
      }),
    ]);

    await campaignContactRepo.save([
      campaignContactRepo.create({
        campaignId: campaigns[0].id,
        contactId: contacts[0].id,
        status: CampaignContactStatus.ASSIGNED,
        importBatch: 'BATCH-WEB-001',
        assignedAt: new Date('2026-04-05T08:30:00Z'),
      }),
      campaignContactRepo.create({
        campaignId: campaigns[0].id,
        contactId: contacts[1].id,
        status: CampaignContactStatus.COMPLETED,
        importBatch: 'BATCH-WEB-001',
        assignedAt: new Date('2026-04-05T08:40:00Z'),
      }),
      campaignContactRepo.create({
        campaignId: campaigns[0].id,
        contactId: contacts[2].id,
        status: CampaignContactStatus.PENDING,
        importBatch: 'BATCH-WEB-001',
        assignedAt: null,
      }),
      campaignContactRepo.create({
        campaignId: campaigns[1].id,
        contactId: contacts[3].id,
        status: CampaignContactStatus.FAILED,
        importBatch: 'BATCH-WA-001',
        assignedAt: null,
      }),
      campaignContactRepo.create({
        campaignId: campaigns[1].id,
        contactId: contacts[4].id,
        status: CampaignContactStatus.ASSIGNED,
        importBatch: 'BATCH-WA-001',
        assignedAt: new Date('2026-04-06T10:00:00Z'),
      }),
    ]);

    const sessions = await sessionRepo.save([
      sessionRepo.create({
        campaignId: campaigns[0].id,
        contactId: contacts[0].id,
        agentId: agents[0].id,
        channel: SessionChannel.WEB,
        status: ChatSessionStatus.ACTIVE,
        startedAt: new Date('2026-04-10T03:00:00Z'),
        endedAt: null,
      }),
      sessionRepo.create({
        campaignId: campaigns[0].id,
        contactId: contacts[1].id,
        agentId: agents[1].id,
        channel: SessionChannel.WEB,
        status: ChatSessionStatus.COMPLETED,
        startedAt: new Date('2026-04-09T05:00:00Z'),
        endedAt: new Date('2026-04-09T05:20:00Z'),
      }),
      sessionRepo.create({
        campaignId: campaigns[1].id,
        contactId: contacts[4].id,
        agentId: null,
        channel: SessionChannel.WHATSAPP,
        status: ChatSessionStatus.PENDING,
        startedAt: null,
        endedAt: null,
      }),
    ]);

    await messageRepo.save([
      messageRepo.create({
        sessionId: sessions[0].id,
        senderType: MessageSenderType.CUSTOMER,
        senderId: null,
        content: 'Xin chao, minh can ho tro goi cuoc.',
        messageType: MessageType.TEXT,
        isRead: true,
      }),
      messageRepo.create({
        sessionId: sessions[0].id,
        senderType: MessageSenderType.AGENT,
        senderId: agents[0].id,
        content: 'Chao ban, minh co the ho tro ngay bay gio.',
        messageType: MessageType.TEXT,
        isRead: true,
      }),
      messageRepo.create({
        sessionId: sessions[1].id,
        senderType: MessageSenderType.CUSTOMER,
        senderId: null,
        content: 'Toi muon doi goi cao hon.',
        messageType: MessageType.TEXT,
        isRead: true,
      }),
      messageRepo.create({
        sessionId: sessions[1].id,
        senderType: MessageSenderType.AGENT,
        senderId: agents[1].id,
        content: 'Minh da cap nhat thanh cong, cam on ban.',
        messageType: MessageType.TEXT,
        isRead: true,
      }),
      messageRepo.create({
        sessionId: sessions[1].id,
        senderType: MessageSenderType.SYSTEM,
        senderId: null,
        content: 'Session closed by agent.',
        messageType: MessageType.SYSTEM,
        isRead: true,
      }),
    ]);

    await importLogRepo.save([
      importLogRepo.create({
        campaignId: campaigns[0].id,
        fileName: 'summer-retention-web.csv',
        totalRows: 3,
        successRows: 3,
        failedRows: 0,
        status: CsvImportStatus.COMPLETED,
        errorLog: null,
        importedById: supervisor.id,
      }),
      importLogRepo.create({
        campaignId: campaigns[1].id,
        fileName: 'whatsapp-upsell-q2.csv',
        totalRows: 2,
        successRows: 1,
        failedRows: 1,
        status: CsvImportStatus.FAILED,
        errorLog: {
          errors: [{ row: 2, reason: 'Invalid whatsapp_id format' }],
        },
        importedById: supervisor.id,
      }),
    ]);

    console.log('Seed test data completed successfully.');
    console.log(
      `Summary: users=${1 + agents.length}, teams=${teams.length}, campaigns=${campaigns.length}, contacts=${contacts.length}, sessions=${sessions.length}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('Failed to seed test data.', error);
  process.exit(1);
});
