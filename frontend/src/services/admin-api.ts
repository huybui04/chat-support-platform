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
export type ReportsExportFormat = "csv" | "json";

type ReportsQuery = PaginationQuery & {
  window?: ReportsWindow;
};

type ExportReportsQuery = ReportsQuery & {
  kind: ReportsExportKind;
  campaignId?: string;
  all?: boolean;
  format?: ReportsExportFormat;
};

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
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

export type CreateCampaignPayload = {
  name: string;
  description?: string;
  status?: Campaign["status"];
  channel?: Campaign["channel"];
  startDate?: string;
  endDate?: string;
  createdById: string;
};

export type UpdateCampaignPayload = Omit<
  CreateCampaignPayload,
  "createdById"
> & {
  createdById?: string;
};

export type CreateAgentPayload = {
  keycloakId: string;
  fullName: string;
  email: string;
  role?: User["role"];
  isActive?: boolean;
  isOnline?: boolean;
};

export type UpdateAgentPayload = {
  fullName?: string;
  email?: string;
  role?: User["role"];
  isActive?: boolean;
};

export type CreateTeamPayload = {
  name: string;
  description?: string;
  createdById: string;
};

export type UpdateTeamPayload = {
  name?: string;
  description?: string;
};

export type CreateContactPayload = {
  fullName: string;
  phone?: string;
  email?: string;
  whatsappId?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateContactPayload = Partial<CreateContactPayload>;

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

export async function createCampaign(payload: CreateCampaignPayload) {
  const response = await apiRequest<ApiResponse<Campaign>>("/campaigns", {
    method: "POST",
    body: payload,
  });
  return response.data;
}

export async function updateCampaign(
  id: string,
  payload: UpdateCampaignPayload,
) {
  const response = await apiRequest<ApiResponse<Campaign>>(`/campaigns/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return response.data;
}

export async function deleteCampaign(id: string) {
  await apiRequest<ApiResponse<{ id: string }>>(`/campaigns/${id}`, {
    method: "DELETE",
  });
}

export async function getAgents(
  query: PaginationQuery = {},
): Promise<PaginatedResult<User>> {
  const response = await apiRequest<ApiResponse<User[]>>(
    `/users${toQueryString({ ...query, role: "agent" })}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function createAgent(payload: CreateAgentPayload) {
  const response = await apiRequest<ApiResponse<User>>("/users", {
    method: "POST",
    body: {
      ...payload,
      role: payload.role ?? "agent",
    },
  });
  return response.data;
}

export async function updateAgent(id: string, payload: UpdateAgentPayload) {
  const response = await apiRequest<ApiResponse<User>>(`/users/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return response.data;
}

export async function deleteAgent(id: string) {
  const response = await apiRequest<ApiResponse<User>>(`/users/${id}`, {
    method: "DELETE",
  });
  return response.data;
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

export async function createTeam(payload: CreateTeamPayload) {
  const response = await apiRequest<ApiResponse<Team>>("/teams", {
    method: "POST",
    body: payload,
  });
  return response.data;
}

export async function updateTeam(id: string, payload: UpdateTeamPayload) {
  const response = await apiRequest<ApiResponse<Team>>(`/teams/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return response.data;
}

export async function deleteTeam(id: string) {
  await apiRequest<ApiResponse<{ id: string }>>(`/teams/${id}`, {
    method: "DELETE",
  });
}

export async function getContacts(
  query: PaginationQuery = {},
): Promise<PaginatedResult<Contact>> {
  const response = await apiRequest<ApiResponse<Contact[]>>(
    `/contacts${toQueryString(query)}`,
  );
  return { items: response.data, meta: response.meta };
}

export async function createContact(payload: CreateContactPayload) {
  const response = await apiRequest<ApiResponse<Contact>>("/contacts", {
    method: "POST",
    body: payload,
  });
  return response.data;
}

export async function updateContact(id: string, payload: UpdateContactPayload) {
  const response = await apiRequest<ApiResponse<Contact>>(`/contacts/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return response.data;
}

export async function deleteContact(id: string) {
  await apiRequest<ApiResponse<{ id: string }>>(`/contacts/${id}`, {
    method: "DELETE",
  });
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
    throw new Error(await readExportError(response));
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

async function readExportError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as {
        message?: string | string[];
      };
      if (Array.isArray(payload.message)) {
        return payload.message.join("; ");
      }
      if (typeof payload.message === "string" && payload.message) {
        return payload.message;
      }
    } catch {
      // Fallback to plain text below.
    }
  }

  const text = await response.text();
  return text || `${response.status} ${response.statusText}`;
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
