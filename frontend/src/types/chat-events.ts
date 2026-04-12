export type SessionPendingPayload = {
  id: string;
  status: string;
};

export type SessionAssignedPayload = {
  id: string;
  agentId: string | null;
};

export type AgentStatusChanged = {
  agentId: string;
  isOnline: boolean;
};
