import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

import {
  Campaign,
  CampaignAgent,
  CampaignChannel,
  CampaignContact,
  CampaignContactStatus,
  CampaignStatus,
  CampaignType,
  ChannelCampaignMapping,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  Contact,
  ExternalChannel,
  GmailAccount,
  MessageSenderType,
  MessageType,
  SessionChannel,
  User,
  UserRole,
} from '../../database/entities';
import { ChatGateway } from '../chat/chat.gateway';
import { SessionsService } from '../sessions/sessions.service';
import { AiService } from '../ai/ai.service';

const DEFAULT_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
];

type GmailTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type GmailProfile = {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
};

type GmailHistoryListResponse = {
  history?: Array<{
    id: string;
    messagesAdded?: Array<{ message: GmailMessage }>;
    messages?: GmailMessage[];
  }>;
  historyId?: string;
  nextPageToken?: string;
};

type GmailMessage = {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<GmailMessage['payload']>;
  };
};

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    @InjectRepository(GmailAccount)
    private readonly gmailAccountsRepository: Repository<GmailAccount>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
    @InjectRepository(CampaignContact)
    private readonly campaignContactsRepository: Repository<CampaignContact>,
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(CampaignAgent)
    private readonly campaignAgentsRepository: Repository<CampaignAgent>,
    @InjectRepository(ChannelCampaignMapping)
    private readonly channelCampaignMappingsRepository: Repository<ChannelCampaignMapping>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @Inject(forwardRef(() => SessionsService))
    private readonly sessionsService: SessionsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    private readonly aiService: AiService,
  ) {}

  buildOAuthAuthorizeUrl(returnUrl?: string) {
    const clientId = process.env.GMAIL_CLIENT_ID?.trim();
    const redirectUri = process.env.GMAIL_REDIRECT_URI?.trim();

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Missing GMAIL_CLIENT_ID or GMAIL_REDIRECT_URI',
      );
    }

    const scopes = this.resolveScopes();
    const state = returnUrl ? encodeState({ returnUrl }) : undefined;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes.join(' '),
    });

    if (state) {
      params.set('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, state?: string) {
    const clientId = process.env.GMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GMAIL_REDIRECT_URI?.trim();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REDIRECT_URI',
      );
    }

    const tokenResponse = await this.exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    const profile = await this.fetchProfile(tokenResponse.access_token);
    if (!profile.emailAddress) {
      throw new BadGatewayException('Failed to resolve Gmail profile');
    }

    const account = await this.upsertAccount(
      profile.emailAddress,
      tokenResponse,
    );
    await this.ensureWatch(account);

    const decodedState = decodeState(state);
    const redirectUrl =
      decodedState?.returnUrl?.trim() ||
      process.env.GMAIL_SUCCESS_REDIRECT_URL?.trim() ||
      '/';

    return redirectUrl;
  }

  async listAccounts() {
    const accounts = await this.gmailAccountsRepository.find({
      order: { createdAt: 'DESC' },
    });

    return accounts.map((account) => ({
      id: account.id,
      email: account.email,
      historyId: account.historyId,
      watchExpiration: account.watchExpiration,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  async handlePubSubPush(payload: Record<string, unknown>) {
    const message = payload?.message as
      | { data?: string; messageId?: string; publishTime?: string }
      | undefined;

    if (!message?.data) {
      return { ignored: true, reason: 'missing_message' };
    }

    const decoded = decodeBase64(message.data);
    let parsed: { emailAddress?: string; historyId?: string } | null = null;

    try {
      parsed = JSON.parse(decoded) as {
        emailAddress?: string;
        historyId?: string;
      };
    } catch {
      return { ignored: true, reason: 'invalid_message' };
    }

    if (!parsed?.emailAddress || !parsed?.historyId) {
      return { ignored: true, reason: 'missing_fields' };
    }

    const account = await this.gmailAccountsRepository.findOne({
      where: { email: parsed.emailAddress },
    });

    if (!account) {
      return { ignored: true, reason: 'account_not_found' };
    }

    const processedCount = await this.syncAccountHistory(
      account,
      parsed.historyId,
    );

    return { processed: processedCount };
  }

  async sendOutboundMessage(session: ChatSession, content: string) {
    const sessionWithContact = await this.sessionsRepository.findOne({
      where: { id: session.id },
      relations: { contact: true },
    });

    const recipientEmail = sessionWithContact?.contact?.email?.trim();
    if (!recipientEmail) {
      throw new BadRequestException('Missing contact email for Gmail outbound');
    }

    const campaign = await this.campaignsRepository.findOne({
      where: { id: session.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found for session');
    }

    const gmailAccountEmail = await this.resolveGmailAccountByCampaignId(
      campaign.id,
    );

    if (!gmailAccountEmail) {
      throw new BadRequestException(
        'Missing Gmail account mapping for campaign (configure channel_mappings with channel=gmail)',
      );
    }

    const account = await this.gmailAccountsRepository.findOne({
      where: { email: gmailAccountEmail },
    });

    if (!account) {
      throw new NotFoundException('Gmail account not found for mapping');
    }

    const accessToken = await this.getAccessToken(account);

    // Find the original inbound message to get Gmail message ID and thread ID for proper threading
    const originalMessage = await this.messagesRepository.findOne({
      where: {
        sessionId: session.id,
        senderType: MessageSenderType.CUSTOMER,
        externalMessageId: Not(IsNull()),
      },
      order: { createdAt: 'ASC' },
    });

    // Use the original subject from the inbound email, or create a new one
    let subject = `Support reply - ${campaign.name}`;
    let replyToMessageId: string | null | undefined;
    let replyThreadId: string | null | undefined;

    if (originalMessage?.externalMessageId) {
      // Use original subject and prepend Re: if not present
      const origSubj =
        originalMessage.subject || `Support reply - ${campaign.name}`;
      subject = origSubj.toLowerCase().startsWith('re:')
        ? origSubj
        : `Re: ${origSubj}`;
      replyToMessageId = originalMessage.rfcMessageId as string | null;
      replyThreadId = originalMessage.externalThreadId as string | null;
    }

    const rawMessage = buildRawEmail({
      to: recipientEmail,
      subject,
      body: content,
      inReplyTo: replyToMessageId ?? undefined,
      references: replyToMessageId ?? undefined,
    });

    const response = await fetch(
      replyThreadId
        ? `https://www.googleapis.com/gmail/v1/users/me/messages/send?threadId=${encodeURIComponent(String(replyThreadId))}`
        : 'https://www.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawMessage }),
      },
    );

    if (response.ok) {
      this.logger.debug(
        `Gmail outbound success for session=${session.id} to=${recipientEmail} threadId=${replyThreadId ?? 'N/A'}`,
      );
      return;
    }

    const errorBody = await response.text();
    throw new BadGatewayException(
      `Gmail outbound failed (${response.status}): ${errorBody}`,
    );
  }

  private resolveScopes() {
    const rawScopes = process.env.GMAIL_OAUTH_SCOPES?.trim();
    if (!rawScopes) {
      return DEFAULT_GMAIL_SCOPES;
    }

    return rawScopes
      .split(/[\s,]+/g)
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private async exchangeCodeForTokens(input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    const body = new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(
        `Gmail token exchange failed (${response.status}): ${errorBody}`,
      );
    }

    return (await response.json()) as GmailTokenResponse;
  }

  private async fetchProfile(accessToken: string) {
    const response = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/profile',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(
        `Gmail profile fetch failed (${response.status}): ${errorBody}`,
      );
    }

    return (await response.json()) as GmailProfile;
  }

  private async upsertAccount(email: string, tokens: GmailTokenResponse) {
    const existing = await this.gmailAccountsRepository.findOne({
      where: { email },
    });

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    if (existing) {
      existing.accessToken = tokens.access_token;
      existing.accessTokenExpiresAt = expiresAt;
      if (tokens.refresh_token) {
        existing.refreshToken = tokens.refresh_token;
      }
      return this.gmailAccountsRepository.save(existing);
    }

    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Missing refresh token; re-consent with prompt=consent required',
      );
    }

    return this.gmailAccountsRepository.save(
      this.gmailAccountsRepository.create({
        email,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: expiresAt,
      }),
    );
  }

  private async ensureWatch(account: GmailAccount) {
    const topicName = process.env.GMAIL_PUBSUB_TOPIC?.trim();
    if (!topicName) {
      throw new BadRequestException('Missing GMAIL_PUBSUB_TOPIC');
    }

    const labelIds = resolveLabelIds();
    const accessToken = await this.getAccessToken(account);

    const response = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/watch',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicName,
          labelIds: labelIds.length > 0 ? labelIds : undefined,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(
        `Gmail watch setup failed (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      historyId?: string;
      expiration?: string;
    };

    account.historyId = data.historyId ?? account.historyId;
    account.watchExpiration = data.expiration
      ? new Date(Number(data.expiration))
      : account.watchExpiration;

    await this.gmailAccountsRepository.save(account);
  }

  private async getAccessToken(account: GmailAccount) {
    if (account.accessToken && account.accessTokenExpiresAt) {
      const expiresAt = account.accessTokenExpiresAt.getTime();
      if (Date.now() + 60_000 < expiresAt) {
        return account.accessToken;
      }
    }

    const clientId = process.env.GMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET',
      );
    }

    if (!account.refreshToken) {
      throw new BadRequestException('Missing Gmail refresh token');
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(
        `Gmail token refresh failed (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as GmailTokenResponse;
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

    account.accessToken = data.access_token;
    account.accessTokenExpiresAt = expiresAt;
    await this.gmailAccountsRepository.save(account);

    return data.access_token;
  }

  private async syncAccountHistory(
    account: GmailAccount,
    incomingHistoryId: string,
  ) {
    if (!account.historyId) {
      account.historyId = incomingHistoryId;
      await this.gmailAccountsRepository.save(account);
      return 0;
    }

    const history = await this.listHistory(account, account.historyId);
    if (!history) {
      account.historyId = incomingHistoryId;
      await this.gmailAccountsRepository.save(account);
      return 0;
    }

    const messageIds = collectMessageIds(history);

    let processed = 0;
    for (const messageId of messageIds) {
      const message = await this.getMessage(account, messageId);
      const handled = await this.processInboundMessage(account, message);
      if (handled) {
        processed += 1;
      }
    }

    if (history.historyId) {
      account.historyId = history.historyId;
      await this.gmailAccountsRepository.save(account);
    }

    return processed;
  }

  private async listHistory(account: GmailAccount, startHistoryId: string) {
    const accessToken = await this.getAccessToken(account);
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: 'messageAdded',
    });

    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/history?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(
        `Gmail history fetch failed (${response.status}): ${errorBody}`,
      );
    }

    return (await response.json()) as GmailHistoryListResponse;
  }

  private async getMessage(account: GmailAccount, messageId: string) {
    const accessToken = await this.getAccessToken(account);
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(
        `Gmail message fetch failed (${response.status}): ${errorBody}`,
      );
    }

    return (await response.json()) as GmailMessage;
  }

  private async processInboundMessage(
    account: GmailAccount,
    message: GmailMessage,
  ) {
    if (!isPrimaryInboxMessage(message)) {
      return false;
    }

    const headers = message.payload?.headers ?? [];
    const fromHeader = findHeader(headers, 'From');
    const subjectHeader = findHeader(headers, 'Subject');
    const messageIdHeader = findHeader(headers, 'Message-ID');
    const fromInfo = parseEmailContact(fromHeader);

    if (!fromInfo.email) {
      return false;
    }

    if (fromInfo.email.toLowerCase() === account.email.toLowerCase()) {
      return false;
    }

    const campaign = await this.resolveCampaignByAccount(account.email);
    if (!campaign) {
      this.logger.warn(`No campaign mapped for Gmail account ${account.email}`);
      return false;
    }

    if (!this.isCampaignEligibleForInbound(campaign)) {
      throw new ForbiddenException('Campaign not eligible for inbound Gmail');
    }

    const contact = await this.resolveContact(fromInfo);
    await this.ensureCampaignContactLink(campaign.id, contact.id);

    let session = await this.findOpenSession(
      campaign.id,
      contact.id,
      SessionChannel.GMAIL,
    );
    let createdSession = false;

    if (!session) {
      const autoAssignedAgentId = await this.resolveAutoAssignableAgentId(
        campaign.id,
      );

      session = await this.sessionsService.create({
        campaignId: campaign.id,
        contactId: contact.id,
        agentId: autoAssignedAgentId ?? undefined,
        channel: SessionChannel.GMAIL,
      });

      if (autoAssignedAgentId) {
        await this.markCampaignContactAssigned(campaign.id, contact.id);
      }

      createdSession = true;
    }

    const bodyText =
      extractBodyText(message.payload) ||
      message.snippet ||
      subjectHeader ||
      '';

    const chatMessage = await this.messagesRepository.save(
      this.messagesRepository.create({
        sessionId: session.id,
        senderType: MessageSenderType.CUSTOMER,
        senderId: null,
        content: bodyText,
        messageType: MessageType.TEXT,
        attachmentUrl: null,
        externalMessageId: message.id,
        externalThreadId: message.threadId ?? null,
        rfcMessageId: messageIdHeader || null,
        isRead: false,
        subject: subjectHeader || null,
      }),
    );

    this.chatGateway.emitSessionMessage(session.id, chatMessage);

    await this.maybeAutoReplyForInbound({
      session,
      campaign,
      contact,
      customerMessage: bodyText,
    });

    if (createdSession) {
      this.logger.debug(`Created Gmail session ${session.id}`);
    }

    return true;
  }

  private async maybeAutoReplyForInbound(input: {
    session: ChatSession;
    campaign: Campaign;
    contact: Contact;
    customerMessage: string;
  }) {
    if (!this.aiService.isAutoReplyEnabled(SessionChannel.GMAIL)) {
      return;
    }

    const reply = await this.aiService.generateAutoReply({
      channel: SessionChannel.GMAIL,
      campaignName: input.campaign.name,
      customerName: input.contact.fullName,
      customerMessage: input.customerMessage,
    });

    if (!reply) {
      return;
    }

    await this.sendOutboundMessage(input.session, reply);

    const message = await this.messagesRepository.save(
      this.messagesRepository.create({
        sessionId: input.session.id,
        senderType: MessageSenderType.AGENT,
        senderId: null,
        content: reply,
        messageType: MessageType.TEXT,
        attachmentUrl: null,
        isRead: false,
      }),
    );

    this.chatGateway.emitSessionMessage(input.session.id, message);
  }

  private async resolveCampaignByAccount(accountEmail: string) {
    const mappings = await this.channelCampaignMappingsRepository.find({
      where: {
        channel: ExternalChannel.GMAIL,
        isActive: true,
        externalAccountId: accountEmail,
      },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });

    if (mappings.length === 0) {
      return null;
    }

    const campaignIds = mappings.map((mapping) => mapping.campaignId);
    const campaigns = await this.campaignsRepository.find({
      where: { id: In(campaignIds) },
    });

    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.id, campaign]),
    );

    for (const mapping of mappings) {
      const campaign = campaignById.get(mapping.campaignId);
      if (campaign) {
        return campaign;
      }
    }

    return null;
  }

  private async resolveContact(info: { email: string; name?: string | null }) {
    const email = info.email.trim().toLowerCase();
    const existingContact = await this.contactsRepository.findOne({
      where: { email },
    });

    if (existingContact) {
      return existingContact;
    }

    return this.contactsRepository.save(
      this.contactsRepository.create({
        fullName: info.name?.trim() || email,
        email,
        phone: null,
        whatsappId: null,
        metadata: {
          source: 'gmail',
          email,
        },
      }),
    );
  }

  private async ensureCampaignContactLink(
    campaignId: string,
    contactId: string,
  ) {
    const existingLink = await this.campaignContactsRepository.findOne({
      where: { campaignId, contactId },
    });

    if (existingLink) {
      return existingLink;
    }

    return this.campaignContactsRepository.save(
      this.campaignContactsRepository.create({
        campaignId,
        contactId,
        status: CampaignContactStatus.PENDING,
        importBatch: 'gmail-webhook',
        assignedAt: null,
      }),
    );
  }

  private async findOpenSession(
    campaignId: string,
    contactId: string,
    sessionChannel: SessionChannel,
  ) {
    return this.sessionsRepository.findOne({
      where: {
        campaignId,
        contactId,
        channel: sessionChannel,
        status: In([ChatSessionStatus.PENDING, ChatSessionStatus.ACTIVE]),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  private async markCampaignContactAssigned(
    campaignId: string,
    contactId: string,
  ) {
    await this.campaignContactsRepository.update(
      { campaignId, contactId },
      {
        status: CampaignContactStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    );
  }

  private async resolveAutoAssignableAgentId(campaignId: string) {
    if (!this.isAutoAssignEnabled()) {
      return null;
    }

    const assignments = await this.campaignAgentsRepository.find({
      where: { campaignId },
      order: { assignedAt: 'ASC' },
    });

    if (assignments.length === 0) {
      return null;
    }

    const agentIds = assignments.map((assignment) => assignment.agentId);

    const onlineAgents = await this.usersRepository.find({
      where: {
        id: In(agentIds),
        role: UserRole.AGENT,
        isActive: true,
        isOnline: true,
      },
      select: { id: true },
    });

    if (onlineAgents.length === 0) {
      return null;
    }

    const onlineAgentIds = new Set(onlineAgents.map((agent) => agent.id));
    for (const assignment of assignments) {
      if (onlineAgentIds.has(assignment.agentId)) {
        return assignment.agentId;
      }
    }

    return null;
  }

  private isAutoAssignEnabled() {
    const rawFlag = process.env.GMAIL_AUTO_ASSIGN_ENABLED?.trim();

    return rawFlag === '1' || rawFlag?.toLowerCase() === 'true';
  }

  private isCampaignEligibleForInbound(campaign: Campaign) {
    if (campaign.channel !== CampaignChannel.GMAIL) {
      return false;
    }

    if (campaign.status !== CampaignStatus.ACTIVE) {
      return false;
    }

    if (campaign.type !== CampaignType.INBOUND) {
      return false;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (campaign.startDate && campaign.startDate > today) {
      return false;
    }

    if (campaign.endDate && campaign.endDate < today) {
      return false;
    }

    return true;
  }

  private async resolveGmailAccountByCampaignId(campaignId: string) {
    const mapping = await this.channelCampaignMappingsRepository.findOne({
      where: {
        channel: ExternalChannel.GMAIL,
        campaignId,
        isActive: true,
      },
      order: { priority: 'ASC', createdAt: 'ASC' },
      select: { externalAccountId: true },
    });

    if (mapping?.externalAccountId?.trim()) {
      return mapping.externalAccountId.trim();
    }

    return null;
  }
}

function isPrimaryInboxMessage(message: GmailMessage) {
  const labels = message.labelIds ?? [];
  if (labels.length === 0) {
    return false;
  }

  if (!labels.includes('INBOX')) {
    return false;
  }

  if (!labels.includes('CATEGORY_PERSONAL')) {
    return false;
  }

  const excludedCategories = [
    'CATEGORY_PROMOTIONS',
    'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES',
    'CATEGORY_FORUMS',
  ];

  return !excludedCategories.some((label) => labels.includes(label));
}

function encodeState(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeState(state?: string) {
  if (!state) {
    return null;
  }

  try {
    const padded = state
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(state.length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as { returnUrl?: string };
  } catch {
    return null;
  }
}

function decodeBase64(encoded: string) {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function resolveLabelIds() {
  const raw = process.env.GMAIL_WATCH_LABELS?.trim();
  if (!raw) {
    return [] as string[];
  }

  return raw
    .split(/[\s,]+/g)
    .map((label) => label.trim())
    .filter(Boolean);
}

function collectMessageIds(history: GmailHistoryListResponse) {
  const ids = new Set<string>();

  for (const entry of history.history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      if (added?.message?.id) {
        ids.add(added.message.id);
      }
    }

    for (const message of entry.messages ?? []) {
      if (message?.id) {
        ids.add(message.id);
      }
    }
  }

  return [...ids];
}

function findHeader(
  headers: Array<{ name: string; value: string }>,
  name: string,
) {
  const target = name.toLowerCase();
  const match = headers.find((header) => header.name.toLowerCase() === target);
  return match?.value;
}

function parseEmailContact(raw?: string) {
  if (!raw) {
    return { email: '', name: '' };
  }

  const match = raw.match(/^(.*)<([^>]+)>/);
  if (match) {
    return {
      name: match[1].replace(/"/g, '').trim(),
      email: match[2].trim(),
    };
  }

  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return {
    name: '',
    email: emailMatch ? emailMatch[0] : raw.trim(),
  };
}

function extractBodyText(payload?: GmailMessage['payload']): string {
  if (!payload) {
    return '';
  }

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  for (const part of payload.parts ?? []) {
    const text: string = extractBodyText(part);
    if (text) {
      return text;
    }
  }

  return '';
}

function buildRawEmail(input: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const lines = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`] : []),
    ...(input.references ? [`References: ${input.references}`] : []),
    '',
    input.body,
  ];

  return Buffer.from(lines.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
