import { useEffect, useState } from "react";

import {
  getAgentsReport,
  getCampaignReports,
  getSessionsReport,
  type ReportsWindow,
  type AgentReport,
  type CampaignReport,
  type SessionsReport,
} from "../../services/admin-api";
import { StatusLegend } from "../../components/common/status-legend";
import { useAuth } from "../../store/auth-context";
import { useAdminPresence } from "../../store/use-admin-presence";

type DashboardState = {
  campaigns: CampaignReport[];
  agents: AgentReport[];
  sessions: SessionsReport | null;
};

export function AdminDashboardPage() {
  const { token } = useAuth();
  const {
    socketState,
    agentStatuses,
    lastEventAt,
    queueEventTick,
    lastQueueEventAt,
  } = useAdminPresence(token);
  const [state, setState] = useState<DashboardState>({
    campaigns: [],
    agents: [],
    sessions: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSessionsSyncAt, setLastSessionsSyncAt] = useState<string | null>(
    null,
  );
  const [windowFilter, setWindowFilter] = useState<ReportsWindow>("all");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [campaignsResult, agentsResult, sessionsResult] =
          await Promise.all([
            getCampaignReports({ page: 1, limit: 10, window: windowFilter }),
            getAgentsReport({ page: 1, limit: 10, window: windowFilter }),
            getSessionsReport({ window: windowFilter }),
          ]);

        if (!mounted) {
          return;
        }

        setState({
          campaigns: campaignsResult.items,
          agents: agentsResult.items,
          sessions: sessionsResult,
        });
        setLastSessionsSyncAt(new Date().toISOString());
      } catch (caughtError) {
        if (!mounted) {
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load dashboard data",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [windowFilter]);

  useEffect(() => {
    if (!token || queueEventTick === 0) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void Promise.all([
        getCampaignReports({ page: 1, limit: 10, window: windowFilter }),
        getAgentsReport({ page: 1, limit: 10, window: windowFilter }),
        getSessionsReport({ window: windowFilter }),
      ])
        .then(([campaignsResult, agentsResult, sessionsResult]) => {
          if (cancelled) {
            return;
          }

          setState({
            campaigns: campaignsResult.items,
            agents: agentsResult.items,
            sessions: sessionsResult,
          });
          setLastSessionsSyncAt(new Date().toISOString());
        })
        .catch(() => {
          // Preserve existing dashboard data when a background refresh fails.
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [queueEventTick, token, windowFilter]);

  const onlineAgentsCount = state.agents.filter(
    (agent) => agentStatuses[agent.agentId] ?? agent.isOnline,
  ).length;

  return (
    <section className="placeholder-page">
      <h1>Admin Dashboard</h1>
      <p>Overview from reports endpoints for quick operational monitoring.</p>
      <p className="status-note with-badges">
        Realtime presence:
        <span className={`status-badge ${socketState}`}>{socketState}</span>
        <span>Online agents:</span>
        <span className="status-badge online">{onlineAgentsCount}</span>
      </p>
      <div className="page-actions">
        <label>
          Time window
          <select
            value={windowFilter}
            onChange={(event) =>
              setWindowFilter(event.target.value as ReportsWindow)
            }
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>
      <p className="status-note">
        Last realtime update:{" "}
        {lastEventAt ? new Date(lastEventAt).toLocaleTimeString() : "-"}
      </p>
      <p className="status-note">
        Last queue event:{" "}
        {lastQueueEventAt
          ? new Date(lastQueueEventAt).toLocaleTimeString()
          : "-"}
      </p>
      <p className="status-note">
        Sessions KPI synced:{" "}
        {lastSessionsSyncAt
          ? new Date(lastSessionsSyncAt).toLocaleTimeString()
          : "-"}
      </p>
      <StatusLegend
        items={[
          { key: "connected", label: "Connected" },
          { key: "connecting", label: "Connecting" },
          { key: "disconnected", label: "Disconnected" },
          { key: "online", label: "Online" },
          { key: "offline", label: "Offline" },
        ]}
      />

      {loading ? <p className="status-note">Loading dashboard...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      {state.sessions ? (
        <div className="admin-kpi-grid">
          <article>
            <h3>Total Sessions</h3>
            <p>{state.sessions.totalSessions}</p>
          </article>
          <article>
            <h3>Active Sessions</h3>
            <p>{state.sessions.byStatus.active}</p>
          </article>
          <article>
            <h3>Completed Sessions</h3>
            <p>{state.sessions.byStatus.completed}</p>
          </article>
          <article>
            <h3>Avg Duration (s)</h3>
            <p>{Math.round(state.sessions.avgSessionDurationSeconds)}</p>
          </article>
        </div>
      ) : null}

      <div className="admin-panel-grid">
        <section className="data-panel">
          <h2>Top Campaigns</h2>
          <ul className="compact-list">
            {state.campaigns.slice(0, 5).map((campaign) => (
              <li key={campaign.campaignId}>
                <span>{campaign.name}</span>
                <strong>{campaign.sessions.active} active</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="data-panel">
          <h2>Top Agents</h2>
          <ul className="compact-list">
            {state.agents.slice(0, 5).map((agent) => (
              <li key={agent.agentId}>
                <span>{agent.fullName}</span>
                <strong>
                  {agent.handledSessions} handled |{" "}
                  <span
                    className={`status-badge ${(agentStatuses[agent.agentId] ?? agent.isOnline) ? "online" : "offline"}`}
                  >
                    {(agentStatuses[agent.agentId] ?? agent.isOnline)
                      ? "online"
                      : "offline"}
                  </span>
                </strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
