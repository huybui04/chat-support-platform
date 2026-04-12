import { useEffect, useState } from "react";

import {
  downloadReportsCsv,
  getCampaignReportDetail,
  getAgentsReport,
  getCampaignReports,
  type ReportsExportFormat,
  type ReportsExportKind,
  type ReportsWindow,
  type AgentReport,
  type CampaignDetailReport,
  type CampaignReport,
} from "../../services/admin-api";
import { StatusLegend } from "../../components/common/status-legend";
import { useAuth } from "../../store/auth-context";
import { useAdminPresence } from "../../store/use-admin-presence";

type ReportsState = {
  campaigns: CampaignReport[];
  agents: AgentReport[];
};

export function AdminReportsPage() {
  const { token } = useAuth();
  const { socketState, agentStatuses, queueEventTick, lastQueueEventAt } =
    useAdminPresence(token);
  const [state, setState] = useState<ReportsState>({
    campaigns: [],
    agents: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [windowFilter, setWindowFilter] = useState<ReportsWindow>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [campaignDetail, setCampaignDetail] =
    useState<CampaignDetailReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [exportBusy, setExportBusy] = useState<ReportsExportKind | "">("");
  const [exportError, setExportError] = useState("");
  const [exportFormat, setExportFormat] = useState<ReportsExportFormat>("csv");
  const exportFormatLabel = exportFormat.toUpperCase();

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [campaignsResult, agentsResult] = await Promise.all([
          getCampaignReports({ page: 1, limit: 20, window: windowFilter }),
          getAgentsReport({ page: 1, limit: 20, window: windowFilter }),
        ]);

        if (!mounted) {
          return;
        }

        setState({
          campaigns: campaignsResult.items,
          agents: agentsResult.items,
        });
        setLastSyncedAt(new Date().toISOString());
      } catch (caughtError) {
        if (!mounted) {
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load reports",
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
        getCampaignReports({ page: 1, limit: 20, window: windowFilter }),
        getAgentsReport({ page: 1, limit: 20, window: windowFilter }),
      ])
        .then(([campaignsResult, agentsResult]) => {
          if (cancelled) {
            return;
          }

          setState({
            campaigns: campaignsResult.items,
            agents: agentsResult.items,
          });
          setLastSyncedAt(new Date().toISOString());
        })
        .catch(() => {
          // Keep previous report snapshot when background refresh fails.
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [queueEventTick, token, windowFilter]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignDetail(null);
      setDetailError("");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const detail = await getCampaignReportDetail(selectedCampaignId, {
          window: windowFilter,
        });

        if (cancelled) {
          return;
        }

        setCampaignDetail(detail);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setDetailError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load campaign detail",
        );
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, windowFilter, queueEventTick]);

  const exportCsv = async (kind: ReportsExportKind) => {
    setExportBusy(kind);
    setExportError("");
    try {
      await downloadReportsCsv({
        kind,
        window: windowFilter,
        campaignId:
          kind === "campaign-detail"
            ? (selectedCampaignId ?? undefined)
            : undefined,
        all: true,
        format: exportFormat,
      });
    } catch (caughtError) {
      setExportError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to export report",
      );
    } finally {
      setExportBusy("");
    }
  };

  return (
    <section className="placeholder-page">
      <h1>Reports</h1>
      <p>Campaign and agent analytics from reporting endpoints.</p>
      <p className="status-note with-badges">
        Realtime presence:
        <span className={`status-badge ${socketState}`}>{socketState}</span>
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
        <label>
          Export format
          <select
            value={exportFormat}
            onChange={(event) =>
              setExportFormat(event.target.value as ReportsExportFormat)
            }
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
      </div>
      <div className="page-actions">
        <button
          type="button"
          onClick={() => void exportCsv("campaigns")}
          disabled={exportBusy !== ""}
        >
          Export Campaign {exportFormatLabel}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void exportCsv("agents")}
          disabled={exportBusy !== ""}
        >
          Export Agent {exportFormatLabel}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void exportCsv("sessions")}
          disabled={exportBusy !== ""}
        >
          Export Sessions {exportFormatLabel}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void exportCsv("campaign-detail")}
          disabled={!selectedCampaignId || exportBusy !== ""}
        >
          Export Detail {exportFormatLabel}
        </button>
      </div>
      {exportError ? <p className="error-note">{exportError}</p> : null}
      <p className="status-note">
        Last report sync:{" "}
        {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "-"}
      </p>
      <p className="status-note">
        Last queue event:{" "}
        {lastQueueEventAt
          ? new Date(lastQueueEventAt).toLocaleTimeString()
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

      {loading ? <p className="status-note">Loading reports...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="data-panel">
        <h2>Campaign Overview</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Contacts</th>
              <th>Pending</th>
              <th>Active</th>
              <th>Completed</th>
              <th>Abandoned</th>
            </tr>
          </thead>
          <tbody>
            {state.campaigns.map((campaign) => (
              <tr key={campaign.campaignId}>
                <td>
                  <button
                    type="button"
                    className="inline-link-button"
                    onClick={() => setSelectedCampaignId(campaign.campaignId)}
                  >
                    {campaign.name}
                  </button>
                </td>
                <td>{campaign.totalContacts}</td>
                <td>{campaign.sessions.pending}</td>
                <td>{campaign.sessions.active}</td>
                <td>{campaign.sessions.completed}</td>
                <td>{campaign.sessions.abandoned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-panel">
        <h2>Campaign Detail</h2>
        {!selectedCampaignId ? (
          <p className="status-note">Select a campaign name to view detail.</p>
        ) : null}
        {detailLoading ? (
          <p className="status-note">Loading campaign detail...</p>
        ) : null}
        {detailError ? <p className="error-note">{detailError}</p> : null}
        {campaignDetail ? (
          <div className="admin-kpi-grid">
            <article>
              <h3>Total Contacts</h3>
              <p>{campaignDetail.totalContacts}</p>
            </article>
            <article>
              <h3>Completed Sessions</h3>
              <p>{campaignDetail.sessions.completed}</p>
            </article>
            <article>
              <h3>Avg Response (s)</h3>
              <p>{Math.round(campaignDetail.avgResponseTimeSeconds)}</p>
            </article>
            <article>
              <h3>Avg Duration (s)</h3>
              <p>{Math.round(campaignDetail.avgSessionDurationSeconds)}</p>
            </article>
          </div>
        ) : null}
      </div>

      <div className="data-panel">
        <h2>Agent Performance</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Email</th>
              <th>Handled</th>
              <th>Completed</th>
              <th>Avg Duration (s)</th>
              <th>Online</th>
            </tr>
          </thead>
          <tbody>
            {state.agents.map((agent) => (
              <tr key={agent.agentId}>
                <td>{agent.fullName}</td>
                <td>{agent.email}</td>
                <td>{agent.handledSessions}</td>
                <td>{agent.completedSessions}</td>
                <td>{Math.round(agent.avgSessionDurationSeconds)}</td>
                <td>
                  <span
                    className={`status-badge ${(agentStatuses[agent.agentId] ?? agent.isOnline) ? "online" : "offline"}`}
                  >
                    {(agentStatuses[agent.agentId] ?? agent.isOnline)
                      ? "online"
                      : "offline"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
