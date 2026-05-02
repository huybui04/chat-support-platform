export type SessionPendingPayload = {
  id: string;
  status: string;
  campaignName?: string | null;
  channel?: string;
};

export type SessionAssignedPayload = {
  id: string;
  agentId: string | null;
  agentName?: string | null;
  campaignName?: string | null;
  channel?: string;
};

export type AgentStatusChanged = {
  agentId: string;
  isOnline: boolean;
};

export type AgentsOnlineSnapshot = {
  agentIds: string[];
};
