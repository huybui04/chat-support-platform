import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PaginationControls } from "../../components/common/pagination-controls";
import {
  acceptSession,
  endSession,
  getSessions,
  type ChatSession,
} from "../../services/agent-api";
import { getCurrentUser } from "../../services/admin-api";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

export function AgentSessionListPage() {
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
