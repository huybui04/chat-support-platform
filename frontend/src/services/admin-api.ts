import { apiRequest } from "./http-client";
import { readAuthState } from "./auth-storage";
import type { ApiResponse, PaginatedResult } from "../types/api";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

type PaginationQuery = {
  page?: number;
  limit?: number;
};

export type ReportsWindow = "24h" | "7d" | "30d" | "all";
export type ReportsExportKind =
  | "campaigns"
  | "agents"
  | "sessions"
  | "campaign-detail";

type ReportsQuery = PaginationQuery & {
  window?: ReportsWindow;
};

type ExportReportsQuery = ReportsQuery & {
  kind: ReportsExportKind;
  campaignId?: string;
  all?: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  channel: "web" | "whatsapp";
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  keycloakId: string;
  fullName: string;
  email: string;
  role: "supervisor" | "agent";
  isActive: boolean;
  isOnline: boolean;
};

export type Team = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type Contact = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsappId: string | null;
  createdAt: string;
};

export type CampaignReport = {
  campaignId: string;
  name: string;
  totalContacts: number;
  sessions: {
    pending: number;
    active: number;
    completed: number;
    abandoned: number;
  };
};

export type CampaignDetailReport = {
  campaignId: string;
  name: string;
  totalContacts: number;
  sessions: {
    pending: number;
    active: number;
    completed: number;
    abandoned: number;
  };
  avgResponseTimeSeconds: number;
  avgSessionDurationSeconds: number;
};

export type AgentReport = {
  agentId: string;
  fullName: string;
  email: string;
  isOnline: boolean;
  handledSessions: number;
  completedSessions: number;
  avgSessionDurationSeconds: number;
};

export type SessionsReport = {
  totalSessions: number;
  byStatus: {
    pending: number;
    active: number;
    completed: number;
    abandoned: number;
  };
  avgSessionDurationSeconds: number;
};

export async function getCampaigns(
  query: PaginationQuery = {},
): Promise<PaginatedResult<Campaign>> {
  const response = await apiRequest<ApiResponse<Campaign[]>>(
    `/campaigns${toQueryString(query)}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function getAgents(
  query: PaginationQuery = {},
): Promise<PaginatedResult<User>> {
  const response = await apiRequest<ApiResponse<User[]>>(
    `/users${toQueryString({ ...query, role: "agent" })}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiRequest<ApiResponse<User>>("/users/me");
  return response.data;
}

export async function updateUserStatus(
  userId: string,
  isOnline: boolean,
): Promise<User> {
  const response = await apiRequest<ApiResponse<User>>(
    `/users/${userId}/status`,
    {
      method: "PATCH",
      body: { isOnline },
    },
  );

  return response.data;
}

export function updateUserStatusKeepalive(
  userId: string,
  isOnline: boolean,
  token: string,
): void {
  if (!token) {
    return;
  }

  void fetch(`${apiBaseUrl}/users/${userId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isOnline }),
    keepalive: true,
  });
}

export async function getTeams(
  query: PaginationQuery = {},
): Promise<PaginatedResult<Team>> {
  const response = await apiRequest<ApiResponse<Team[]>>(
    `/teams${toQueryString(query)}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function getContacts(
  query: PaginationQuery = {},
): Promise<PaginatedResult<Contact>> {
  const response = await apiRequest<ApiResponse<Contact[]>>(
    `/contacts${toQueryString(query)}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function getCampaignReports(
  query: ReportsQuery = {},
): Promise<PaginatedResult<CampaignReport>> {
  const response = await apiRequest<ApiResponse<CampaignReport[]>>(
    `/reports/campaigns${toQueryString(query)}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function getAgentsReport(
  query: ReportsQuery = {},
): Promise<PaginatedResult<AgentReport>> {
  const response = await apiRequest<ApiResponse<AgentReport[]>>(
    `/reports/agents${toQueryString(query)}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function getCampaignReportDetail(
  campaignId: string,
  query: Pick<ReportsQuery, "window"> = {},
): Promise<CampaignDetailReport> {
  const response = await apiRequest<ApiResponse<CampaignDetailReport>>(
    `/reports/campaigns/${campaignId}${toQueryString(query)}`,
  );
  return response.data;
}

export async function getSessionsReport(
  query: Pick<ReportsQuery, "window"> = {},
): Promise<SessionsReport> {
  const response = await apiRequest<ApiResponse<SessionsReport>>(
    `/reports/sessions${toQueryString(query)}`,
  );
  return response.data;
}

export async function downloadReportsCsv(query: ExportReportsQuery) {
  const token = readAuthState().token;

  const response = await fetch(
    `${apiBaseUrl}/reports/export${toQueryString(query)}`,
    {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fallback = `reports-${new Date().toISOString().replace(/[.:]/g, "-")}.csv`;
  const filename = filenameMatch?.[1] ?? fallback;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function toQueryString(
  params: Record<string, string | number | boolean | undefined>,
) {
  const entries = Object.entries(params).filter(
    (entry) => entry[1] !== undefined,
  );

  if (entries.length === 0) {
    return "";
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of entries) {
    searchParams.set(key, String(value));
  }

  return `?${searchParams.toString()}`;
}
