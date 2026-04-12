import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  acceptSession,
  endSession,
  getSessions,
  type ChatSession,
} from "../../services/agent-api";
import { getCurrentUser } from "../../services/admin-api";

export function AgentSessionListPage() {
  const navigate = useNavigate();
  const [pendingItems, setPendingItems] = useState<ChatSession[]>([]);
  const [activeItems, setActiveItems] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySessionId, setBusySessionId] = useState("");
  const [currentAgentId, setCurrentAgentId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let resolvedAgentId = currentAgentId;
      if (!resolvedAgentId) {
        const currentUser = await getCurrentUser();
        resolvedAgentId = currentUser.id;
        setCurrentAgentId(currentUser.id);
      }

      const [pendingResult, activeResult] = await Promise.all([
        getSessions({ status: "pending" }),
        getSessions({ status: "active", agentId: resolvedAgentId }),
      ]);
      setPendingItems(pendingResult.items);
      setActiveItems(activeResult.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load sessions",
      );
    } finally {
      setLoading(false);
    }
  }, [currentAgentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

      {loading ? <p className="status-note">Loading sessions...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="admin-panel-grid">
        <div className="data-panel">
          <h2>Pending</h2>
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
        </div>

        <div className="data-panel">
          <h2>Active</h2>
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
        </div>
      </div>
    </section>
  );
}
