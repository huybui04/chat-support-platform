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
import { useAuth } from "../../store/auth-context";
import { useAdminPresence } from "../../store/use-admin-presence";

type InteractionCounts = {
  total: number;
  inQueue: number;
  handled: number;
  handling: number;
};

type InteractionMetrics = {
  counts: InteractionCounts;
  avgResponseSeconds: number;
};

type DashboardState = {
  campaigns: CampaignReport[];
  agents: AgentReport[];
  sessions: SessionsReport | null;
  interaction: {
    email: InteractionMetrics;
    chat: InteractionMetrics;
  };
};

const CHAT_CHANNELS: Array<"whatsapp" | "instagram" | "messenger"> = [
  "whatsapp",
  "instagram",
  "messenger",
];

const EMPTY_COUNTS: InteractionCounts = {
  total: 0,
  inQueue: 0,
  handled: 0,
  handling: 0,
};

const EMPTY_METRICS: InteractionMetrics = {
  counts: EMPTY_COUNTS,
  avgResponseSeconds: 0,
};

export function AdminDashboardPage() {
  const { token } = useAuth();
  const { agentStatuses, queueEventTick } = useAdminPresence(token);
  const [state, setState] = useState<DashboardState>({
    campaigns: [],
    agents: [],
    sessions: null,
    interaction: {
      email: EMPTY_METRICS,
      chat: EMPTY_METRICS,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [windowFilter, setWindowFilter] = useState<ReportsWindow>("all");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [campaignsResult, agentsResult, sessionsResult, interaction] =
          await Promise.all([
            getCampaignReports({
              page: 1,
              limit: 10,
              window: windowFilter,
            }),
            getAgentsReport({
              page: 1,
              limit: 10,
              window: windowFilter,
            }),
            getSessionsReport({
              window: windowFilter,
            }),
            loadInteractionMetrics(windowFilter),
          ]);

        if (!mounted) {
          return;
        }

        setState({
          campaigns: campaignsResult.items,
          agents: agentsResult.items,
          sessions: sessionsResult,
          interaction,
        });
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
        getCampaignReports({
          page: 1,
          limit: 10,
          window: windowFilter,
        }),
        getAgentsReport({
          page: 1,
          limit: 10,
          window: windowFilter,
        }),
        getSessionsReport({
          window: windowFilter,
        }),
        loadInteractionMetrics(windowFilter),
      ])
        .then(
          ([campaignsResult, agentsResult, sessionsResult, interaction]) => {
            if (cancelled) {
              return;
            }

            setState({
              campaigns: campaignsResult.items,
              agents: agentsResult.items,
              sessions: sessionsResult,
              interaction,
            });
          },
        )
        .catch(() => {
          // Preserve existing dashboard data when a background refresh fails.
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [queueEventTick, token, windowFilter]);

  return (
    <section className="placeholder-page admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
        </div>
        <div className="admin-dashboard-filters">
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
      </header>

      {loading ? <p className="status-note">Loading dashboard...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      {state.sessions ? (
        <div className="admin-dashboard-kpis">
          <article className="admin-kpi-card">
            <span className="admin-kpi-label">Total Sessions</span>
            <p className="admin-kpi-value">{state.sessions.totalSessions}</p>
          </article>
          <article className="admin-kpi-card">
            <span className="admin-kpi-label">Active Sessions</span>
            <p className="admin-kpi-value">{state.sessions.byStatus.active}</p>
          </article>
          <article className="admin-kpi-card">
            <span className="admin-kpi-label">Completed Sessions</span>
            <p className="admin-kpi-value">
              {state.sessions.byStatus.completed}
            </p>
          </article>
          <article className="admin-kpi-card">
            <span className="admin-kpi-label">Avg Duration (s)</span>
            <p className="admin-kpi-value">
              {Math.round(state.sessions.avgSessionDurationSeconds)}
            </p>
          </article>
        </div>
      ) : null}

      <section className="admin-interaction-metrics">
        <header>
          <h2>Interaction Metrics</h2>
        </header>
        <div className="admin-interaction-grid">
          <article className="interaction-card">
            <div className="interaction-card-header">
              <div className="interaction-icon email" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v.4l8 4.8 8-4.8V8H4zm16 8V9.8l-7.4 4.4a1.2 1.2 0 0 1-1.2 0L4 9.8V16h16z" />
                </svg>
              </div>
              <div>
                <p className="interaction-label">Email</p>
              </div>
            </div>
            <div className="interaction-stats">
              <div>
                <p className="interaction-label">Total</p>
                <p className="interaction-value">
                  {state.interaction.email.counts.total}
                </p>
              </div>
              <div>
                <p className="interaction-label">In Queue</p>
                <p className="interaction-value">
                  {state.interaction.email.counts.inQueue}
                </p>
              </div>
              <div>
                <p className="interaction-label">Handled</p>
                <p className="interaction-value">
                  {state.interaction.email.counts.handled}
                </p>
              </div>
              <div>
                <p className="interaction-label">Handling</p>
                <p className="interaction-value">
                  {state.interaction.email.counts.handling}
                </p>
              </div>
            </div>
            <div className="interaction-sla">
              <span className="interaction-sla-label">Avg Email SLA</span>
              <strong>
                {formatDuration(state.interaction.email.avgResponseSeconds)}
              </strong>
            </div>
          </article>
          <article className="interaction-card">
            <div className="interaction-card-header">
              <div className="interaction-icon chat" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v9h2v1.2L8.8 15H20V6H4z" />
                </svg>
              </div>
              <div>
                <p className="interaction-label">Chat</p>
              </div>
            </div>
            <div className="interaction-stats">
              <div>
                <p className="interaction-label">Total</p>
                <p className="interaction-value">
                  {state.interaction.chat.counts.total}
                </p>
              </div>
              <div>
                <p className="interaction-label">In Queue</p>
                <p className="interaction-value">
                  {state.interaction.chat.counts.inQueue}
                </p>
              </div>
              <div>
                <p className="interaction-label">Handled</p>
                <p className="interaction-value">
                  {state.interaction.chat.counts.handled}
                </p>
              </div>
              <div>
                <p className="interaction-label">Handling</p>
                <p className="interaction-value">
                  {state.interaction.chat.counts.handling}
                </p>
              </div>
            </div>
            <div className="interaction-sla">
              <span className="interaction-sla-label">Avg Chat SLA</span>
              <strong>
                {formatDuration(state.interaction.chat.avgResponseSeconds)}
              </strong>
            </div>
          </article>
        </div>
      </section>

      <div className="admin-dashboard-panels">
        <section className="data-panel">
          <h2>Top Campaigns</h2>
          <ul className="compact-list">
            {state.campaigns
              .slice()
              .sort((a, b) => b.sessions.active - a.sessions.active)
              .slice(0, 5)
              .map((campaign) => (
                <li key={campaign.campaignId}>
                  <span>
                    {campaign.name} ({campaign.channel})
                  </span>
                  <strong>{campaign.sessions.active} active</strong>
                </li>
              ))}
          </ul>
        </section>

        <section className="data-panel">
          <h2>Top Agents</h2>
          <ul className="compact-list">
            {state.agents
              .slice()
              .sort((a, b) => b.handledSessions - a.handledSessions)
              .slice(0, 5)
              .map((agent) => (
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

async function loadInteractionMetrics(windowFilter: ReportsWindow) {
  const emailReport = await getSessionsReport({
    window: windowFilter,
    channel: "gmail",
  });

  const chatReports = await Promise.all(
    CHAT_CHANNELS.map((channel) =>
      getSessionsReport({ window: windowFilter, channel }),
    ),
  );

  const emailInQueue = emailReport.byStatus.pending ?? 0;
  const emailHandling = emailReport.byStatus.active ?? 0;
  const emailHandled = emailReport.byStatus.completed ?? 0;

  const chatByStatus = chatReports.reduce(
    (acc, report) => ({
      pending: acc.pending + (report.byStatus.pending ?? 0),
      active: acc.active + (report.byStatus.active ?? 0),
      completed: acc.completed + (report.byStatus.completed ?? 0),
    }),
    { pending: 0, active: 0, completed: 0 },
  );
  const chatInQueue = chatByStatus.pending;
  const chatHandling = chatByStatus.active;
  const chatHandled = chatByStatus.completed;

  const chatTotals = chatReports.map((report) => report.totalSessions);
  const chatWeightedSum = chatReports.reduce(
    (sum, report) => sum + report.avgResponseTimeSeconds * report.totalSessions,
    0,
  );
  const chatTotalSessions = chatTotals.reduce((sum, count) => sum + count, 0);
  const chatAvgResponseSeconds = chatTotalSessions
    ? Math.round(chatWeightedSum / chatTotalSessions)
    : 0;

  return {
    email: {
      counts: {
        total: emailInQueue + emailHandling + emailHandled,
        inQueue: emailInQueue,
        handled: emailHandled,
        handling: emailHandling,
      },
      avgResponseSeconds: Math.round(emailReport.avgResponseTimeSeconds ?? 0),
    },
    chat: {
      counts: {
        total: chatInQueue + chatHandling + chatHandled,
        inQueue: chatInQueue,
        handled: chatHandled,
        handling: chatHandling,
      },
      avgResponseSeconds: chatAvgResponseSeconds,
    },
  };
}

function formatDuration(totalSeconds: number) {
  const secs = Math.max(0, Math.round(totalSeconds ?? 0));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}
