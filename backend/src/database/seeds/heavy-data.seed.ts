import 'dotenv/config';

import dataSource from '../data-source';
import { CampaignAgent } from '../entities/campaign-agent.entity';
import {
  Campaign,
  CampaignChannel,
  CampaignStatus,
  CampaignType,
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

const CONTACT_COUNT = Number(process.env.SEED_CONTACT_COUNT ?? 1000);
const CAMPAIGN_COUNT = Number(process.env.SEED_CAMPAIGN_COUNT ?? 12);
const TEAM_COUNT = Number(process.env.SEED_TEAM_COUNT ?? 6);
const AGENT_COUNT = Number(process.env.SEED_AGENT_COUNT ?? 30);
const MESSAGE_PER_SESSION = Number(process.env.SEED_MESSAGES_PER_SESSION ?? 8);

function getCampaignStatus(index: number): CampaignStatus {
  const statuses = [
    CampaignStatus.ACTIVE,
    CampaignStatus.ACTIVE,
    CampaignStatus.PAUSED,
    CampaignStatus.COMPLETED,
    CampaignStatus.DRAFT,
  ];
  return statuses[index % statuses.length];
}

function getContactStatus(index: number): CampaignContactStatus {
  const statuses = [
    CampaignContactStatus.PENDING,
    CampaignContactStatus.ASSIGNED,
    CampaignContactStatus.COMPLETED,
    CampaignContactStatus.FAILED,
  ];
  return statuses[index % statuses.length];
}

function getSessionStatus(index: number): ChatSessionStatus {
  const statuses = [
    ChatSessionStatus.PENDING,
    ChatSessionStatus.ACTIVE,
    ChatSessionStatus.COMPLETED,
    ChatSessionStatus.ABANDONED,
  ];
  return statuses[index % statuses.length];
}

function toDate(daysAgo: number, minuteOffset: number): Date {
  const base = new Date();
  base.setDate(base.getDate() - daysAgo);
  base.setMinutes(base.getMinutes() + minuteOffset);
  return base;
}

async function seedHeavyData(): Promise<void> {
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
        keycloakId: 'kc-heavy-supervisor-001',
        email: 'heavy.supervisor@test.local',
        fullName: 'Heavy Supervisor',
        role: UserRole.SUPERVISOR,
        isActive: true,
        isOnline: true,
      }),
    );

    const agentUsers = Array.from({ length: AGENT_COUNT }, (_, i) =>
      userRepo.create({
        keycloakId: `kc-heavy-agent-${String(i + 1).padStart(3, '0')}`,
        email: `heavy.agent.${i + 1}@test.local`,
        fullName: `Heavy Agent ${i + 1}`,
        role: UserRole.AGENT,
        isActive: true,
        isOnline: i % 3 === 0,
      }),
    );
    const agents = await userRepo.save(agentUsers, { chunk: 100 });

    const teamRows = Array.from({ length: TEAM_COUNT }, (_, i) =>
      teamRepo.create({
        name: `Heavy Team ${i + 1}`,
        description: `Auto-generated team ${i + 1} for load testing`,
        createdById: supervisor.id,
      }),
    );
    const teams = await teamRepo.save(teamRows);

    const teamMembers = agents.map((agent, i) =>
      teamMemberRepo.create({
        teamId: teams[i % teams.length].id,
        userId: agent.id,
      }),
    );
    await teamMemberRepo.save(teamMembers, { chunk: 200 });

    const campaignRows = Array.from({ length: CAMPAIGN_COUNT }, (_, i) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (90 - i * 2));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 60);

      return campaignRepo.create({
        name: `Heavy Campaign ${i + 1}`,
        description: `Load test campaign ${i + 1}`,
        status: getCampaignStatus(i),
        channel: i % 2 === 0 ? CampaignChannel.WEB : CampaignChannel.WHATSAPP,
        type: i % 2 === 0 ? CampaignType.OUTBOUND : CampaignType.INBOUND,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        createdById: supervisor.id,
      });
    });
    const campaigns = await campaignRepo.save(campaignRows);

    const campaignTeams = campaigns.map((campaign, i) =>
      campaignTeamRepo.create({
        campaignId: campaign.id,
        teamId: teams[i % teams.length].id,
      }),
    );
    await campaignTeamRepo.save(campaignTeams, { chunk: 200 });

    const campaignAgents: CampaignAgent[] = [];
    for (let i = 0; i < campaigns.length; i += 1) {
      for (let j = 0; j < 6; j += 1) {
        const agent = agents[(i * 6 + j) % agents.length];
        campaignAgents.push(
          campaignAgentRepo.create({
            campaignId: campaigns[i].id,
            agentId: agent.id,
          }),
        );
      }
    }
    await campaignAgentRepo.save(campaignAgents, { chunk: 300 });

    const contactRows = Array.from({ length: CONTACT_COUNT }, (_, i) =>
      contactRepo.create({
        fullName: `Test Contact ${i + 1}`,
        phone: `+8490${String(1000000 + i).slice(-7)}`,
        email: `contact.${i + 1}@load.local`,
        whatsappId: i % 2 === 0 ? `84${String(900000000 + i)}` : null,
        metadata: {
          city: ['HCM', 'HN', 'Da Nang', 'Can Tho'][i % 4],
          source: ['csv-import', 'web-widget', 'whatsapp', 'manual'][i % 4],
          tier: ['A', 'B', 'C'][i % 3],
        },
      }),
    );
    const contacts = await contactRepo.save(contactRows, { chunk: 500 });

    const campaignContacts = contacts.map((contact, i) => {
      const status = getContactStatus(i);
      return campaignContactRepo.create({
        campaignId: campaigns[i % campaigns.length].id,
        contactId: contact.id,
        status,
        importBatch: `HEAVY-BATCH-${String((i % 20) + 1).padStart(3, '0')}`,
        assignedAt:
          status === CampaignContactStatus.PENDING
            ? null
            : toDate(i % 45, i % 50),
      });
    });
    await campaignContactRepo.save(campaignContacts, { chunk: 500 });

    const sessionContacts = contacts.filter((_, i) => i % 10 !== 0);
    const sessionRows = sessionContacts.map((contact, i) => {
      const status = getSessionStatus(i);
      const startedAt =
        status === ChatSessionStatus.PENDING ? null : toDate(i % 30, i % 100);
      const endedAt =
        status === ChatSessionStatus.COMPLETED ||
        status === ChatSessionStatus.ABANDONED
          ? toDate(i % 30, (i % 100) + 15)
          : null;

      return sessionRepo.create({
        campaignId: campaigns[i % campaigns.length].id,
        contactId: contact.id,
        agentId:
          status === ChatSessionStatus.PENDING
            ? null
            : agents[i % agents.length].id,
        channel:
          campaigns[i % campaigns.length].channel === CampaignChannel.WEB
            ? SessionChannel.WEB
            : SessionChannel.WHATSAPP,
        status,
        startedAt,
        endedAt,
      });
    });
    const sessions = await sessionRepo.save(sessionRows, { chunk: 400 });

    const messageRows: ChatMessage[] = [];
    for (let i = 0; i < sessions.length; i += 1) {
      const session = sessions[i];
      const agentId = session.agentId;
      const baseMinutes = (i % 120) * 2;

      messageRows.push(
        messageRepo.create({
          sessionId: session.id,
          senderType: MessageSenderType.CUSTOMER,
          senderId: null,
          content: `Customer ${i + 1}: Need support for campaign flow`,
          messageType: MessageType.TEXT,
          isRead: true,
          createdAt: toDate(i % 20, baseMinutes),
        }),
      );

      for (let m = 0; m < MESSAGE_PER_SESSION - 2; m += 1) {
        const isAgent = m % 2 === 0;
        messageRows.push(
          messageRepo.create({
            sessionId: session.id,
            senderType: isAgent
              ? MessageSenderType.AGENT
              : MessageSenderType.CUSTOMER,
            senderId: isAgent ? agentId : null,
            content: isAgent
              ? `Agent reply ${m + 1} for session ${i + 1}`
              : `Customer follow-up ${m + 1} for session ${i + 1}`,
            messageType: MessageType.TEXT,
            isRead: m % 3 !== 0,
            createdAt: toDate(i % 20, baseMinutes + m + 1),
          }),
        );
      }

      messageRows.push(
        messageRepo.create({
          sessionId: session.id,
          senderType: MessageSenderType.SYSTEM,
          senderId: null,
          content: `System note for session ${i + 1}`,
          messageType: MessageType.SYSTEM,
          isRead: true,
          createdAt: toDate(i % 20, baseMinutes + MESSAGE_PER_SESSION),
        }),
      );
    }
    await messageRepo.save(messageRows, { chunk: 1000 });

    const importLogs = campaigns.map((campaign, i) => {
      const totalRows = Math.floor(CONTACT_COUNT / campaigns.length);
      const failedRows = i % 5 === 0 ? Math.floor(totalRows * 0.05) : 0;
      const successRows = totalRows - failedRows;
      return importLogRepo.create({
        campaignId: campaign.id,
        fileName: `heavy-import-campaign-${String(i + 1).padStart(2, '0')}.csv`,
        totalRows,
        successRows,
        failedRows,
        status:
          failedRows > 0 ? CsvImportStatus.FAILED : CsvImportStatus.COMPLETED,
        errorLog:
          failedRows > 0
            ? {
                errors: [
                  {
                    reason: 'Invalid row format',
                    estimatedRows: failedRows,
                  },
                ],
              }
            : null,
        importedById: supervisor.id,
      });
    });
    await importLogRepo.save(importLogs, { chunk: 200 });

    console.log('Heavy seed completed successfully.');
    console.log(
      [
        `users=${1 + agents.length}`,
        `teams=${teams.length}`,
        `campaigns=${campaigns.length}`,
        `contacts=${contacts.length}`,
        `campaignContacts=${campaignContacts.length}`,
        `sessions=${sessions.length}`,
        `messages=${messageRows.length}`,
        `importLogs=${importLogs.length}`,
      ].join(', '),
    );
  } finally {
    await dataSource.destroy();
  }
}

seedHeavyData().catch((error: unknown) => {
  console.error('Failed to seed heavy data.', error);
  process.exit(1);
});
