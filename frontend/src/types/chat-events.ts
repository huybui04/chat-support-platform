export type SessionPendingPayload = {
  id: string;
  status: string;
  campaignName?: string | null;
};

export type SessionAssignedPayload = {
  id: string;
  agentId: string | null;
  agentName?: string | null;
  campaignName?: string | null;
};

export type AgentStatusChanged = {
  agentId: string;
  isOnline: boolean;
};

export type AgentsOnlineSnapshot = {
  agentIds: string[];
};
