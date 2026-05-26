import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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
type SessionTab = "pending" | "active" | "completed";

const EMAIL_INBOX_CHANNEL = "gmail" as const;

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function formatChannel(channel: ChatSession["channel"]): string {
  if (channel === "whatsapp") {
    return "WhatsApp";
  }

  if (channel === "instagram") {
    return "Instagram";
  }

  if (channel === "messenger") {
    return "Messenger";
  }

  if (channel === "gmail") {
    return "Gmail";
  }

  return "Chat";
}

export function AgentEmailListPage() {
  const { token } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingItems, setPendingItems] = useState<ChatSession[]>([]);
  const [pendingMeta, setPendingMeta] = useState<ApiMeta | undefined>();
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [activeItems, setActiveItems] = useState<ChatSession[]>([]);
  const [activeMeta, setActiveMeta] = useState<ApiMeta | undefined>();
  const [activePage, setActivePage] = useState(1);
  const [activeLoading, setActiveLoading] = useState(true);
  const [completedItems, setCompletedItems] = useState<ChatSession[]>([]);
  const [completedMeta, setCompletedMeta] = useState<ApiMeta | undefined>();
  const [completedPage, setCompletedPage] = useState(1);
  const [completedLoading, setCompletedLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SessionTab>(() => {
    const tab = searchParams.get("tab");
    return tab === "active" || tab === "completed" || tab === "pending"
      ? tab
      : "pending";
  });
  const [keyword, setKeyword] = useState("");
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
        visibilityScope: "team",
        channels: [EMAIL_INBOX_CHANNEL],
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
        channels: [EMAIL_INBOX_CHANNEL],
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

  const refreshCompleted = useCallback(async () => {
    setCompletedLoading(true);
    try {
      const resolvedAgentId = await resolveAgentId();
      const completedResult = await getSessions({
        status: "completed",
        agentId: resolvedAgentId,
        page: completedPage,
        limit: PAGE_SIZE,
        channels: [EMAIL_INBOX_CHANNEL],
      });

      if (
        completedPage > 1 &&
        completedResult.items.length === 0 &&
        (completedResult.meta?.total ?? 0) > 0
      ) {
        setCompletedPage((current) => Math.max(1, current - 1));
        return;
      }

      setCompletedItems(completedResult.items);
      setCompletedMeta(completedResult.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load completed sessions",
      );
    } finally {
      setCompletedLoading(false);
    }
  }, [completedPage, resolveAgentId]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    void refreshActive();
  }, [refreshActive]);

  useEffect(() => {
    void refreshCompleted();
  }, [refreshCompleted]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "active" || tab === "completed" || tab === "pending") {
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
      return;
    }

    if (activeTab !== "pending") {
      setActiveTab("pending");
    }
  }, [activeTab, searchParams]);

  const refresh = useCallback(async () => {
    setError("");
    await Promise.all([refreshPending(), refreshActive(), refreshCompleted()]);
  }, [refreshActive, refreshCompleted, refreshPending]);

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

  const normalizedKeyword = keyword.trim().toLowerCase();

  const matchesSession = useCallback(
    (session: ChatSession) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [
          session.id,
          session.campaignId,
          session.contactId,
          session.agentId ?? "",
          session.campaignName ?? "",
          session.contactName ?? "",
          session.agentName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword);

      const matchesChannel = session.channel === "gmail";

      return matchesKeyword && matchesChannel;
    },
    [normalizedKeyword],
  );

  const filteredPendingItems = useMemo(() => {
    return pendingItems.filter(matchesSession);
  }, [matchesSession, pendingItems]);

  const filteredActiveItems = useMemo(() => {
    return activeItems.filter(matchesSession);
  }, [activeItems, matchesSession]);

  const filteredCompletedItems = useMemo(() => {
    return completedItems.filter(matchesSession);
  }, [completedItems, matchesSession]);

  const tabConfig = [
    {
      id: "pending" as const,
      label: "Pending",
      count: pendingMeta?.total ?? pendingItems.length,
      loading: pendingLoading,
      items: filteredPendingItems,
      emptyText: "No pending emails.",
      page: pendingPage,
      total: pendingMeta?.total,
      onPageChange: setPendingPage,
      statusClass: "pending" as const,
    },
    {
      id: "active" as const,
      label: "Active",
      count: activeMeta?.total ?? activeItems.length,
      loading: activeLoading,
      items: filteredActiveItems,
      emptyText: "No active emails.",
      page: activePage,
      total: activeMeta?.total,
      onPageChange: setActivePage,
      statusClass: "active" as const,
    },
    {
      id: "completed" as const,
      label: "Completed",
      count: completedMeta?.total ?? completedItems.length,
      loading: completedLoading,
      items: filteredCompletedItems,
      emptyText: "No completed emails.",
      page: completedPage,
      total: completedMeta?.total,
      onPageChange: setCompletedPage,
      statusClass: "completed" as const,
    },
  ];

  const currentTab =
    tabConfig.find((tab) => tab.id === activeTab) ?? tabConfig[0];

  const onTabChange = (nextTab: SessionTab) => {
    setActiveTab(nextTab);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (nextTab === "pending") {
          next.delete("tab");
        } else {
          next.set("tab", nextTab);
        }

        return next;
      },
      { replace: true },
    );
  };

  return (
    <section className="placeholder-page agent-session-page">
      <div className="agent-session-hero">
        <div>
          <h1>Email Inbox</h1>
          <p>
            Prioritize pending emails, handle active email sessions, and review
            completed email conversations in one workspace.
          </p>
        </div>
        <div className="agent-session-actions">
          <button type="button" onClick={() => void refresh()}>
            Refresh Queue
          </button>
        </div>
      </div>

      <div className="agent-session-kpi-grid">
        <article>
          <h2>Pending</h2>
          <p>{pendingMeta?.total ?? pendingItems.length}</p>
        </article>
        <article>
          <h2>Active</h2>
          <p>{activeMeta?.total ?? activeItems.length}</p>
        </article>
        <article>
          <h2>Completed</h2>
          <p>{completedMeta?.total ?? completedItems.length}</p>
        </article>
        <article>
          <h2>Realtime</h2>
          <p>
            <span className={`status-badge ${socketState}`}>{socketState}</span>
          </p>
          <small>
            Last event:{" "}
            {lastQueueEventAt
              ? new Date(lastQueueEventAt).toLocaleTimeString()
              : "-"}
          </small>
        </article>
      </div>

      <div className="agent-session-toolbar">
        <input
          type="search"
          placeholder="Search by campaign/contact/agent name or id..."
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <select value={EMAIL_INBOX_CHANNEL} disabled>
          <option value="gmail">Gmail</option>
        </select>
      </div>

      <div
        className="management-tabs agent-session-tabs"
        role="tablist"
        aria-label="Session status tabs"
      >
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`management-tab ${activeTab === tab.id ? "active" : ""}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {pendingLoading || activeLoading || completedLoading ? (
        <p className="status-note">Refreshing emails...</p>
      ) : null}
      {error ? <p className="error-note">{error}</p> : null}

      <section
        className="agent-session-board"
        role="tabpanel"
        aria-label={`${currentTab.label} emails`}
      >
        {currentTab.loading ? (
          <p className="status-note">
            Loading {currentTab.label.toLowerCase()} emails...
          </p>
        ) : null}

        {!currentTab.loading && currentTab.items.length === 0 ? (
          <p className="status-note">
            {normalizedKeyword
              ? "No emails matched your filters."
              : currentTab.emptyText}
          </p>
        ) : null}

        <div className="agent-session-card-grid">
          {currentTab.items.map((session) => {
            const isBusy = busySessionId === session.id;
            const canAccept = currentTab.id === "pending";
            const canEnd = currentTab.id === "active";

            return (
              <article key={session.id} className="agent-session-card">
                <header>
                  <h3>Session #{shortId(session.id)}</h3>
                  <span className={`status-badge ${currentTab.statusClass}`}>
                    {session.status}
                  </span>
                </header>

                <dl>
                  <div>
                    <dt>Campaign</dt>
                    <dd>
                      {session.campaignName ??
                        `#${shortId(session.campaignId)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>
                      {session.contactName ?? `#${shortId(session.contactId)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Agent</dt>
                    <dd>
                      {session.agentName ??
                        (session.agentId
                          ? `#${shortId(session.agentId)}`
                          : "Unassigned")}
                    </dd>
                  </div>
                  <div>
                    <dt>Channel</dt>
                    <dd>{formatChannel(session.channel)}</dd>
                  </div>
                  <div>
                    <dt>Session ID</dt>
                    <dd>{session.id}</dd>
                  </div>
                  <div>
                    <dt>Contact ID</dt>
                    <dd>{session.contactId}</dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>{formatDateTime(session.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Ended</dt>
                    <dd>{formatDateTime(session.endedAt)}</dd>
                  </div>
                </dl>

                <footer>
                  {canAccept ? (
                    <button
                      type="button"
                      onClick={() => void onAccept(session.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? "Accepting..." : "Accept"}
                    </button>
                  ) : null}

                  {canEnd ? (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void onEnd(session.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? "Ending..." : "End"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => navigate(`/agent/chat/${session.id}`)}
                  >
                    Open Email
                  </button>
                </footer>
              </article>
            );
          })}
        </div>

        <PaginationControls
          page={currentTab.page}
          limit={PAGE_SIZE}
          total={currentTab.total}
          currentCount={currentTab.items.length}
          loading={currentTab.loading}
          onPageChange={currentTab.onPageChange}
        />
      </section>
    </section>
  );
}
