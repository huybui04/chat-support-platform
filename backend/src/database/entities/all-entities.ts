// import {
//   Campaign,
//   CampaignAgent,
//   CampaignContact,
//   CampaignTeam,
//   ChatMessage,
//   ChatSession,
//   Contact,
//   CsvImportLog,
//   Team,
//   TeamMember,
//   User,
// } from '.';
import { Campaign } from './campaign.entity';
import { CampaignAgent } from './campaign-agent.entity';
import { ChannelCampaignMapping } from './channel-campaign-mapping.entity';
import { CampaignContact } from './campaign-contact.entity';
import { CampaignTeam } from './campaign-team.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatSession } from './chat-session.entity';
import { Contact } from './contact.entity';
import { CsvImportLog } from './csv-import-log.entity';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { User } from './user.entity';

export const ALL_ENTITIES = [
  User,
  Team,
  TeamMember,
  Campaign,
  CampaignTeam,
  CampaignAgent,
  ChannelCampaignMapping,
  Contact,
  CampaignContact,
  ChatSession,
  ChatMessage,
  CsvImportLog,
];
