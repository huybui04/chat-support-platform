import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Socket } from "socket.io-client";

import { getSessions } from "../services/agent-api";
import { createChatSocket } from "../socket/chat-socket";
import type {
  AgentsOnlineSnapshot,
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
  const [completedSessions, setCompletedSessions] = useState<
    Array<{ id: string; agentId: string | null; channel: string }>
  >([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, boolean>>(
    {},
  );
  const [totalHandlingSeconds, setTotalHandlingSeconds] = useState(0);
  const [avgHandlingSeconds, setAvgHandlingSeconds] = useState(0);
  const [agentAvgHandlingSecondsMap, setAgentAvgHandlingSecondsMap] = useState<
    Record<string, number>
  >({});
  const [logs, setLogs] = useState<RealtimeLogItem[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const logCounterRef = useRef(1);
  const hasAutoConnectedRef = useRef(false);

  const metrics = useMemo(
    () => ({
      pendingCount: pendingSessions.length,
      assignedCount: assignedSessions.length,
      onlineAgents: Object.values(agentStatuses).filter(Boolean).length,
      totalHandlingSeconds,
      avgHandlingSeconds,
    }),
    [
      agentStatuses,
      assignedSessions.length,
      pendingSessions.length,
      totalHandlingSeconds,
      avgHandlingSeconds,
    ],
  );

  const pushLog = useCallback((event: string, payload: unknown) => {
    const log: RealtimeLogItem = {
      id: logCounterRef.current,
      at: new Date().toLocaleTimeString(),
      event,
      payload: JSON.stringify(payload),
    };
    logCounterRef.current += 1;
    setLogs((current) => [log, ...current].slice(0, 40));
  }, []);

  const preloadSessions = useCallback(async () => {
    try {
      const [pendingResult, assignedResult, completedResult] =
        await Promise.all([
          getSessions({ status: "pending", page: 1, limit: 30 }),
          getSessions({ status: "active", page: 1, limit: 30 }),
          getSessions({ status: "completed", page: 1, limit: 100 }),
        ]);

      setPendingSessions(
        pendingResult.items.map((item) => ({
          id: item.id,
          status: item.status,
          campaignName: item.campaignName,
        })),
      );

      setAssignedSessions(
        assignedResult.items.map((item) => ({
          id: item.id,
          agentId: item.agentId,
          agentName: item.agentName,
          campaignName: item.campaignName,
        })),
      );

      setCompletedSessions(
        completedResult.items.map((item) => ({
          id: item.id,
          agentId: item.agentId ?? null,
          channel: item.channel,
        })),
      );

      setAgentStatuses(() => {
        const next: Record<string, boolean> = {};
        assignedResult.items.forEach((item) => {
          if (item.agentId) {
            next[item.agentId] = true;
          }
        });
        return next;
      });

      // Compute handling time (from completed sessions) and per-agent averages
      try {
        const durations: number[] = [];
        const perAgentAcc: Record<string, { total: number; count: number }> =
          {};

        for (const s of completedResult.items) {
          if (!s.startedAt || !s.endedAt) continue;
          const started = new Date(s.startedAt).getTime();
          const ended = new Date(s.endedAt).getTime();
          const seconds = Math.max(0, Math.round((ended - started) / 1000));
          if (seconds <= 0) continue;
          durations.push(seconds);

          if (s.agentId) {
            const acc = perAgentAcc[s.agentId] ?? { total: 0, count: 0 };
            acc.total += seconds;
            acc.count += 1;
            perAgentAcc[s.agentId] = acc;
          }
        }

        const total = durations.reduce((a, b) => a + b, 0);
        const avg =
          durations.length > 0 ? Math.round(total / durations.length) : 0;

        const perAgentAvgMap: Record<string, number> = {};
        for (const [agentId, acc] of Object.entries(perAgentAcc)) {
          perAgentAvgMap[agentId] =
            acc.count > 0 ? Math.round(acc.total / acc.count) : 0;
        }

        setTotalHandlingSeconds(total);
        setAvgHandlingSeconds(avg);
        setAgentAvgHandlingSecondsMap(perAgentAvgMap);
      } catch (err) {
        setTotalHandlingSeconds(0);
        setAvgHandlingSeconds(0);
        setAgentAvgHandlingSecondsMap({});
      }

      pushLog("snapshot_loaded", {
        pending: pendingResult.items.length,
        assigned: assignedResult.items.length,
      });
    } catch (error) {
      pushLog("snapshot_failed", {
        message:
          error instanceof Error ? error.message : "Failed to load snapshot",
      });
    }
  }, [pushLog]);

  const connect = useCallback(() => {
    if (!token.trim()) {
      setConnectionState("error");
      pushLog("error", { message: "Missing token" });
      return;
    }

    socketRef.current?.disconnect();

    const socket = createChatSocket({ baseUrl: wsUrl, token });
    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("connect", () => {
      setConnectionState("connected");
      pushLog("connect", { socketId: socket.id });
      void preloadSessions();
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io client disconnect") {
        setConnectionState("disconnected");
      } else {
        setConnectionState("reconnecting");
      }
      pushLog("disconnect", { reason });
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      setConnectionState("reconnecting");
      pushLog("reconnect_attempt", { attempt });
    });

    socket.io.on("reconnect_failed", () => {
      setConnectionState("error");
      pushLog("reconnect_failed", { message: "Unable to reconnect" });
    });

    socket.on("connected", (payload) => {
      pushLog("connected", payload);
    });

    socket.on("agents_online_snapshot", (payload: AgentsOnlineSnapshot) => {
      setAgentStatuses(() => {
        const next: Record<string, boolean> = {};
        payload.agentIds.forEach((agentId) => {
          next[agentId] = true;
        });
        return next;
      });
      pushLog("agents_online_snapshot", payload);
    });

    socket.on(
      "new_session_pending",
      (payload: { session: SessionPendingPayload }) => {
        setPendingSessions((current) => {
          const withoutCurrent = current.filter(
            (item) => item.id !== payload.session.id,
          );
          return [payload.session, ...withoutCurrent].slice(0, 50);
        });
        pushLog("new_session_pending", payload);
      },
    );

    socket.on(
      "session_assigned",
      (payload: { session: SessionAssignedPayload }) => {
        setAssignedSessions((current) => {
          const withoutCurrent = current.filter(
            (item) => item.id !== payload.session.id,
          );
          return [payload.session, ...withoutCurrent].slice(0, 50);
        });
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
  }, [preloadSessions, pushLog, token, wsUrl]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnectionState("disconnected");
  }, []);

  useEffect(() => {
    if (!token.trim() || hasAutoConnectedRef.current) {
      return;
    }

    hasAutoConnectedRef.current = true;
    connect();

    return () => {
      disconnect();
      hasAutoConnectedRef.current = false;
    };
  }, [connect, disconnect, token]);

  return {
    wsUrl,
    setWsUrl,
    token,
    setToken,
    connectionState,
    pendingSessions,
    assignedSessions,
    completedSessions,
    metrics,
    agentAvgHandlingSecondsMap,
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
