import { useEffect, useState } from "react";

import { createChatSocket } from "../socket/chat-socket";
import type { AgentStatusChanged } from "../types/chat-events";

export type RealtimeSocketState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export function useAdminPresence(token: string) {
  const [liveSocketState, setLiveSocketState] =
    useState<RealtimeSocketState>("disconnected");
  const [liveAgentStatuses, setLiveAgentStatuses] = useState<
    Record<string, boolean>
  >({});
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [queueEventTick, setQueueEventTick] = useState(0);
  const [lastQueueEventAt, setLastQueueEventAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL ?? "http://localhost:3001";
    const socket = createChatSocket({ baseUrl: wsUrl, token });

    socket.on("connect", () => {
      setLiveSocketState("connected");
      setLastEventAt(new Date().toISOString());
    });

    socket.on("disconnect", () => {
      setLiveSocketState("disconnected");
      setLastEventAt(new Date().toISOString());
    });

    socket.on("error", () => {
      setLiveSocketState("error");
      setLastEventAt(new Date().toISOString());
    });

    socket.on("agent_status_changed", (payload: AgentStatusChanged) => {
      setLiveAgentStatuses((current) => ({
        ...current,
        [payload.agentId]: payload.isOnline,
      }));
      setLastEventAt(new Date().toISOString());
    });

    const onQueueEvent = () => {
      const at = new Date().toISOString();
      setLastEventAt(at);
      setLastQueueEventAt(at);
      setQueueEventTick((current) => current + 1);
    };

    socket.on("new_session_pending", onQueueEvent);
    socket.on("session_assigned", onQueueEvent);
    socket.on("session_ended", onQueueEvent);

    return () => {
      socket.disconnect();
      setLiveSocketState("disconnected");
      setLiveAgentStatuses({});
      setLastEventAt(null);
      setQueueEventTick(0);
      setLastQueueEventAt(null);
    };
  }, [token]);

  const socketState: RealtimeSocketState = token
    ? liveSocketState
    : "disconnected";
  const agentStatuses = token ? liveAgentStatuses : {};

  return {
    socketState,
    agentStatuses,
    lastEventAt,
    queueEventTick,
    lastQueueEventAt,
  };
}
