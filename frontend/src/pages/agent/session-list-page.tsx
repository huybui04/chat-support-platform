import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PaginationControls } from "../../components/common/pagination-controls";
import { createChatSocket } from "../../socket/chat-socket";
import { useAuth } from "../../store/auth-context";
import { useToast } from "../../store/toast-context";
import {
  acceptSession,
  endSession,
  getSessions,
  type ChatSession,
} from "../../services/agent-api";
import { getCurrentUser } from "../../services/admin-api";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;
type RealtimeSocketState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export function AgentSessionListPage() {
  const { token } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const [pendingItems, setPendingItems] = useState<ChatSession[]>([]);
  const [pendingMeta, setPendingMeta] = useState<ApiMeta | undefined>();
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [activeItems, setActiveItems] = useState<ChatSession[]>([]);
  const [activeMeta, setActiveMeta] = useState<ApiMeta | undefined>();
  const [activePage, setActivePage] = useState(1);
  const [activeLoading, setActiveLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySessionId, setBusySessionId] = useState("");
  const [currentAgentId, setCurrentAgentId] = useState("");
  const [socketState, setSocketState] =
    useState<RealtimeSocketState>("disconnected");
  const [queueEventTick, setQueueEventTick] = useState(0);
  const [lastQueueEventAt, setLastQueueEventAt] = useState<string | null>(null);
  const lastToastAtRef = useRef(0);

  const resolveAgentId = useCallback(async () => {
    if (currentAgentId) {
      return currentAgentId;
    }

    const currentUser = await getCurrentUser();
    setCurrentAgentId(currentUser.id);
    return currentUser.id;
  }, [currentAgentId]);

  const refreshPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const pendingResult = await getSessions({
        status: "pending",
        page: pendingPage,
        limit: PAGE_SIZE,
      });

      if (
        pendingPage > 1 &&
        pendingResult.items.length === 0 &&
        (pendingResult.meta?.total ?? 0) > 0
      ) {
        setPendingPage((current) => Math.max(1, current - 1));
        return;
      }

      setPendingItems(pendingResult.items);
      setPendingMeta(pendingResult.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load pending sessions",
      );
    } finally {
      setPendingLoading(false);
    }
  }, [pendingPage]);

  const refreshActive = useCallback(async () => {
    setActiveLoading(true);
    try {
      const resolvedAgentId = await resolveAgentId();
      const activeResult = await getSessions({
        status: "active",
        agentId: resolvedAgentId,
        page: activePage,
        limit: PAGE_SIZE,
      });

      if (
        activePage > 1 &&
        activeResult.items.length === 0 &&
        (activeResult.meta?.total ?? 0) > 0
      ) {
        setActivePage((current) => Math.max(1, current - 1));
        return;
      }

      setActiveItems(activeResult.items);
      setActiveMeta(activeResult.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load active sessions",
      );
    } finally {
      setActiveLoading(false);
    }
  }, [activePage, resolveAgentId]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    void refreshActive();
  }, [refreshActive]);

  const refresh = useCallback(async () => {
    setError("");
    await Promise.all([refreshPending(), refreshActive()]);
  }, [refreshActive, refreshPending]);

  useEffect(() => {
    if (!token) {
      setSocketState("disconnected");
      setQueueEventTick(0);
      setLastQueueEventAt(null);
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL ?? "http://localhost:3001";
    const socket = createChatSocket({ baseUrl: wsUrl, token });
    setSocketState("connecting");

    socket.on("connect", () => {
      setSocketState("connected");
    });

    socket.on("disconnect", () => {
      setSocketState("disconnected");
    });

    socket.on("error", () => {
      setSocketState("error");
    });

    const maybeNotifyQueueEvent = (message: string) => {
      const now = Date.now();
      if (now - lastToastAtRef.current < 1500) {
        return;
      }
      lastToastAtRef.current = now;
      showSuccess(message);
    };

    const onQueueEvent = () => {
      setQueueEventTick((current) => current + 1);
      setLastQueueEventAt(new Date().toISOString());
    };

    socket.on("new_session_pending", () => {
      onQueueEvent();
      maybeNotifyQueueEvent("New pending session arrived");
    });

    socket.on("session_assigned", () => {
      onQueueEvent();
      maybeNotifyQueueEvent("A session was assigned");
    });

    socket.on("session_ended", () => {
      onQueueEvent();
      maybeNotifyQueueEvent("A session was ended");
    });

    return () => {
      socket.disconnect();
      setSocketState("disconnected");
      setQueueEventTick(0);
      setLastQueueEventAt(null);
    };
  }, [showSuccess, token]);

  useEffect(() => {
    if (!token || queueEventTick === 0) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      void refresh();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [queueEventTick, refresh, token]);

  const onAccept = async (sessionId: string) => {
    setBusySessionId(sessionId);
    try {
      await acceptSession(sessionId);
      await refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to accept session",
      );
    } finally {
      setBusySessionId("");
    }
  };

  const onEnd = async (sessionId: string) => {
    setBusySessionId(sessionId);
    try {
      await endSession(sessionId);
      await refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to end session",
      );
    } finally {
      setBusySessionId("");
    }
  };

  return (
    <section className="placeholder-page">
      <h1>Session List</h1>
      <p>Live session queue with accept/end actions for agents.</p>

      <div className="page-actions">
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      <p className="status-note with-badges">
        Queue realtime:
        <span className={`status-badge ${socketState}`}>{socketState}</span>
        <span>Last queue event:</span>
        <span>
          {lastQueueEventAt
            ? new Date(lastQueueEventAt).toLocaleTimeString()
            : "-"}
        </span>
      </p>

      {pendingLoading || activeLoading ? (
        <p className="status-note">Refreshing sessions...</p>
      ) : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="admin-panel-grid">
        <div className="data-panel">
          <h2>Pending</h2>
          {pendingLoading ? (
            <p className="status-note">Loading pending sessions...</p>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Contact</th>
                <th>Campaign</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!pendingLoading && pendingItems.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="status-note">No pending sessions.</p>
                  </td>
                </tr>
              ) : null}
              {pendingItems.map((session) => (
                <tr key={session.id}>
                  <td>{session.id}</td>
                  <td>{session.contactId}</td>
                  <td>{session.campaignId}</td>
                  <td>
                    <span className="status-badge pending">
                      {session.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void onAccept(session.id)}
                      disabled={busySessionId === session.id}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="secondary inline-action"
                      onClick={() => navigate(`/agent/chat/${session.id}`)}
                    >
                      Open Chat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            page={pendingPage}
            limit={PAGE_SIZE}
            total={pendingMeta?.total}
            currentCount={pendingItems.length}
            loading={pendingLoading}
            onPageChange={setPendingPage}
          />
        </div>

        <div className="data-panel">
          <h2>Active</h2>
          {activeLoading ? (
            <p className="status-note">Loading active sessions...</p>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Agent</th>
                <th>Started</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!activeLoading && activeItems.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="status-note">No active sessions.</p>
                  </td>
                </tr>
              ) : null}
              {activeItems.map((session) => (
                <tr key={session.id}>
                  <td>{session.id}</td>
                  <td>{session.agentId ?? "-"}</td>
                  <td>
                    {session.startedAt
                      ? new Date(session.startedAt).toLocaleString()
                      : "-"}
                  </td>
                  <td>
                    <span className="status-badge active">
                      {session.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void onEnd(session.id)}
                      disabled={busySessionId === session.id}
                    >
                      End
                    </button>
                    <button
                      type="button"
                      className="secondary inline-action"
                      onClick={() => navigate(`/agent/chat/${session.id}`)}
                    >
                      Open Chat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            page={activePage}
            limit={PAGE_SIZE}
            total={activeMeta?.total}
            currentCount={activeItems.length}
            loading={activeLoading}
            onPageChange={setActivePage}
          />
        </div>
      </div>
    </section>
  );
}
