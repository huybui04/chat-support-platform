import { useMemo, useRef, useState } from "react";
import { type Socket } from "socket.io-client";

import { createChatSocket } from "../socket/chat-socket";
import type {
  AgentStatusChanged,
  SessionAssignedPayload,
  SessionPendingPayload,
} from "../types/chat-events";

export type RealtimeLogItem = {
  id: number;
  at: string;
  event: string;
  payload: string;
};

export function useAgentRealtime() {
  const [wsUrl, setWsUrl] = useState(
    import.meta.env.VITE_WS_URL ?? "http://localhost:3001",
  );
  const [token, setToken] = useState(
    import.meta.env.VITE_WS_TOKEN ?? readAuthToken(),
  );
  const [connectionState, setConnectionState] = useState("disconnected");
  const [pendingSessions, setPendingSessions] = useState<
    SessionPendingPayload[]
  >([]);
  const [assignedSessions, setAssignedSessions] = useState<
    SessionAssignedPayload[]
  >([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, boolean>>(
    {},
  );
  const [logs, setLogs] = useState<RealtimeLogItem[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const logCounterRef = useRef(1);

  const metrics = useMemo(
    () => ({
      pendingCount: pendingSessions.length,
      assignedCount: assignedSessions.length,
      onlineAgents: Object.values(agentStatuses).filter(Boolean).length,
    }),
    [agentStatuses, assignedSessions.length, pendingSessions.length],
  );

  const pushLog = (event: string, payload: unknown) => {
    const log: RealtimeLogItem = {
      id: logCounterRef.current,
      at: new Date().toLocaleTimeString(),
      event,
      payload: JSON.stringify(payload),
    };
    logCounterRef.current += 1;
    setLogs((current) => [log, ...current].slice(0, 40));
  };

  const connect = () => {
    socketRef.current?.disconnect();

    const socket = createChatSocket({ baseUrl: wsUrl, token });
    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("connect", () => {
      setConnectionState("connected");
      pushLog("connect", { socketId: socket.id });
    });

    socket.on("disconnect", (reason) => {
      setConnectionState("disconnected");
      pushLog("disconnect", { reason });
    });

    socket.on("connected", (payload) => {
      pushLog("connected", payload);
    });

    socket.on(
      "new_session_pending",
      (payload: { session: SessionPendingPayload }) => {
        setPendingSessions((current) => [payload.session, ...current]);
        pushLog("new_session_pending", payload);
      },
    );

    socket.on(
      "session_assigned",
      (payload: { session: SessionAssignedPayload }) => {
        setAssignedSessions((current) => [payload.session, ...current]);
        setPendingSessions((current) =>
          current.filter((item) => item.id !== payload.session.id),
        );
        pushLog("session_assigned", payload);
      },
    );

    socket.on("agent_status_changed", (payload: AgentStatusChanged) => {
      setAgentStatuses((current) => ({
        ...current,
        [payload.agentId]: payload.isOnline,
      }));
      pushLog("agent_status_changed", payload);
    });

    socket.on("error", (payload) => {
      setConnectionState("error");
      pushLog("error", payload);
    });
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnectionState("disconnected");
  };

  return {
    wsUrl,
    setWsUrl,
    token,
    setToken,
    connectionState,
    pendingSessions,
    assignedSessions,
    metrics,
    logs,
    connect,
    disconnect,
  };
}

function readAuthToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("chat_platform_access_token") ?? "";
}
