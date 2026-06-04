import { apiRequest } from "./http-client";
import type { ApiResponse, PaginatedResult } from "../types/api";

export type ChatSession = {
  id: string;
  campaignId: string;
  campaignName?: string | null;
  contactId: string;
  contactName?: string | null;
  agentId: string | null;
  agentName?: string | null;
  contactEmail?: string | null;
  agentEmail?: string | null;
  channel: "web" | "whatsapp" | "instagram" | "messenger" | "gmail";
  status: "pending" | "active" | "completed" | "abandoned";
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type SessionDetails = ChatSession;

export type CampaignSummary = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  channel: "web" | "whatsapp" | "instagram" | "messenger" | "gmail";
  type: "inbound" | "outbound";
  startDate: string | null;
  endDate: string | null;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  senderType: "agent" | "customer" | "system";
  senderId: string | null;
  content: string;
  subject?: string | null;
  messageType: "text" | "image" | "file" | "system";
  attachmentUrl?: string | null;
  createdAt: string;
};

type GetSessionsInput = {
  status: ChatSession["status"];
  agentId?: string;
  channels?: ChatSession["channel"][];
  page?: number;
  limit?: number;
  visibilityScope?: "team" | "agent";
};

export async function getSessions(
  input: GetSessionsInput,
): Promise<PaginatedResult<ChatSession>> {
  const page = input.page ?? 1;
  const limit = input.limit ?? 30;
  const visibilityScope = input.visibilityScope ?? "team";

  const searchParams = new URLSearchParams({
    status: input.status,
    page: String(page),
    limit: String(limit),
  });

  if (input.agentId) {
    searchParams.set("agentId", input.agentId);
  }

  if (input.channels?.length) {
    for (const channel of input.channels) {
      searchParams.append("channels", channel);
    }
  }

  searchParams.set("visibilityScope", visibilityScope);

  const response = await apiRequest<ApiResponse<ChatSession[]>>(
    `/sessions?${searchParams.toString()}`,
  );

  return { items: response.data, meta: response.meta };
}

export async function acceptSession(sessionId: string): Promise<ChatSession> {
  const response = await apiRequest<ApiResponse<ChatSession>>(
    `/sessions/${sessionId}/accept`,
    {
      method: "POST",
      body: {},
    },
  );

  return response.data;
}

export async function endSession(sessionId: string): Promise<ChatSession> {
  const response = await apiRequest<ApiResponse<ChatSession>>(
    `/sessions/${sessionId}/end`,
    {
      method: "POST",
      body: {},
    },
  );

  return response.data;
}

export async function getSessionById(
  sessionId: string,
): Promise<SessionDetails> {
  const response = await apiRequest<ApiResponse<SessionDetails>>(
    `/sessions/${sessionId}`,
  );

  return response.data;
}

export async function getSessionMessages(
  sessionId: string,
  input?: { beforeMessageId?: string; limit?: number },
): Promise<PaginatedResult<ChatMessage>> {
  const limit = input?.limit ?? 20;
  const searchParams = new URLSearchParams({ limit: String(limit) });

  if (input?.beforeMessageId) {
    searchParams.set("beforeMessageId", input.beforeMessageId);
  }

  const response = await apiRequest<ApiResponse<ChatMessage[]>>(
    `/sessions/${sessionId}/messages?${searchParams.toString()}`,
  );

  return { items: response.data, meta: response.meta };
}

export async function getMyCampaigns(): Promise<CampaignSummary[]> {
  const response = await apiRequest<ApiResponse<CampaignSummary[]>>(
    "/campaigns/me",
  );

  return response.data;
}
