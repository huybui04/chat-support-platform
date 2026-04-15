import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

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
import { PaginationControls } from "../../components/common/pagination-controls";
import { StatusLegend } from "../../components/common/status-legend";
import { useAuth } from "../../store/auth-context";
import { useAdminPresence } from "../../store/use-admin-presence";
import type { ApiMeta } from "../../types/api";

type ReportsState = {
  campaigns: CampaignReport[];
  campaignsMeta?: ApiMeta;
  agents: AgentReport[];
  agentsMeta?: ApiMeta;
};

const REPORTS_PAGE_SIZE = 20;
type ReportsTab = "overview" | "detail" | "agents" | "export";

function toReportsTab(value: string | null): ReportsTab {
  if (value === "overview") return "overview";
  if (value === "detail") return "detail";
  if (value === "agents") return "agents";
  if (value === "export") return "export";
  return "overview";
}

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const { socketState, agentStatuses, queueEventTick, lastQueueEventAt } =
    useAdminPresence(token);
  const [state, setState] = useState<ReportsState>({
    campaigns: [],
    agents: [],
  });
  const [campaignsPage, setCampaignsPage] = useState(1);
  const [agentsPage, setAgentsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportsTab>(() =>
    toReportsTab(searchParams.get("tab")),
  );
  const [windowFilter, setWindowFilter] = useState<ReportsWindow>(() => {
    const value = searchParams.get("window");
    if (value === "24h" || value === "7d" || value === "30d") {
      return value;
    }
    return "all";
  });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    searchParams.get("campaignId"),
  );
  const [overviewKeyword, setOverviewKeyword] = useState("");
  const [campaignDetail, setCampaignDetail] =
    useState<CampaignDetailReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [exportBusy, setExportBusy] = useState<ReportsExportKind | "">("");
  const [exportError, setExportError] = useState("");
  const [exportFormat, setExportFormat] = useState<ReportsExportFormat>("csv");
  const exportFormatLabel = exportFormat.toUpperCase();
  const filteredCampaigns = state.campaigns.filter((campaign) => {
    const keyword = overviewKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return campaign.name.toLowerCase().includes(keyword);
  });

  const detailSessionsTotal = campaignDetail
    ? campaignDetail.sessions.pending +
      campaignDetail.sessions.active +
      campaignDetail.sessions.completed +
      campaignDetail.sessions.abandoned
    : 0;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    params.set("window", windowFilter);
    if (selectedCampaignId) {
      params.set("campaignId", selectedCampaignId);
    }
    setSearchParams(params, { replace: true });
  }, [activeTab, selectedCampaignId, setSearchParams, windowFilter]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [campaignsResult, agentsResult] = await Promise.all([
          getCampaignReports({
            page: campaignsPage,
            limit: REPORTS_PAGE_SIZE,
            window: windowFilter,
          }),
          getAgentsReport({
            page: agentsPage,
            limit: REPORTS_PAGE_SIZE,
            window: windowFilter,
          }),
        ]);

        if (!mounted) {
          return;
        }

        setState({
          campaigns: campaignsResult.items,
          campaignsMeta: campaignsResult.meta,
          agents: agentsResult.items,
          agentsMeta: agentsResult.meta,
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
  }, [agentsPage, campaignsPage, windowFilter]);

  useEffect(() => {
    if (!token || queueEventTick === 0) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void Promise.all([
        getCampaignReports({
          page: campaignsPage,
          limit: REPORTS_PAGE_SIZE,
          window: windowFilter,
        }),
        getAgentsReport({
          page: agentsPage,
          limit: REPORTS_PAGE_SIZE,
          window: windowFilter,
        }),
      ])
        .then(([campaignsResult, agentsResult]) => {
          if (cancelled) {
            return;
          }

          setState({
            campaigns: campaignsResult.items,
            campaignsMeta: campaignsResult.meta,
            agents: agentsResult.items,
            agentsMeta: agentsResult.meta,
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
  }, [agentsPage, campaignsPage, queueEventTick, token, windowFilter]);

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
      <p className="status-note">
        Analytics workspace with focused tabs for overview, detail, agent
        performance, and export.
      </p>
      <p className="status-note with-badges">
        Realtime presence:
        <span className={`status-badge ${socketState}`}>{socketState}</span>
      </p>
      <div className="page-actions">
        <label>
          Time window
          <select
            value={windowFilter}
            onChange={(event) => {
              setCampaignsPage(1);
              setAgentsPage(1);
              setWindowFilter(event.target.value as ReportsWindow);
            }}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </label>
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

      <div className="admin-kpi-grid">
        <article>
          <h3>Campaign rows</h3>
          <p>{state.campaigns.length}</p>
        </article>
        <article>
          <h3>Agent rows</h3>
          <p>{state.agents.length}</p>
        </article>
        <article>
          <h3>Selected campaign</h3>
          <p>{selectedCampaignId ? 1 : 0}</p>
        </article>
        <article>
          <h3>Window</h3>
          <p>{windowFilter}</p>
        </article>
      </div>

      <div
        className="management-tabs"
        role="tablist"
        aria-label="Reports sections"
      >
        <button
          type="button"
          className={`management-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`management-tab ${activeTab === "detail" ? "active" : ""}`}
          onClick={() => setActiveTab("detail")}
        >
          Campaign Detail
        </button>
        <button
          type="button"
          className={`management-tab ${activeTab === "agents" ? "active" : ""}`}
          onClick={() => setActiveTab("agents")}
        >
          Agent Performance
        </button>
        <button
          type="button"
          className={`management-tab ${activeTab === "export" ? "active" : ""}`}
          onClick={() => setActiveTab("export")}
        >
          Export Center
        </button>
      </div>

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

      {activeTab === "overview" ? (
        <>
          <div className="list-toolbar">
            <input
              placeholder="Filter campaigns by name"
              value={overviewKeyword}
              onChange={(event) => setOverviewKeyword(event.target.value)}
            />
          </div>
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
                {!loading && filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <p className="status-note">
                        No campaign matches current filter.
                      </p>
                    </td>
                  </tr>
                ) : null}
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.campaignId}>
                    <td>
                      <button
                        type="button"
                        className="inline-link-button"
                        onClick={() => {
                          setSelectedCampaignId(campaign.campaignId);
                          setActiveTab("detail");
                        }}
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
          <PaginationControls
            page={campaignsPage}
            limit={REPORTS_PAGE_SIZE}
            total={state.campaignsMeta?.total}
            currentCount={state.campaigns.length}
            loading={loading}
            onPageChange={setCampaignsPage}
          />
        </>
      ) : null}

      {activeTab === "detail" ? (
        <div className="data-panel">
          <h2>Campaign Detail</h2>
          <div className="page-actions">
            <label>
              Selected campaign
              <select
                value={selectedCampaignId ?? ""}
                onChange={(event) =>
                  setSelectedCampaignId(event.target.value || null)
                }
              >
                <option value="">Choose campaign</option>
                {state.campaigns.map((campaign) => (
                  <option key={campaign.campaignId} value={campaign.campaignId}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!selectedCampaignId ? (
            <p className="status-note">
              Select a campaign to view detail KPIs.
            </p>
          ) : null}
          {detailLoading ? (
            <p className="status-note">Loading campaign detail...</p>
          ) : null}
          {detailError ? <p className="error-note">{detailError}</p> : null}
          {campaignDetail ? (
            <>
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

              <div className="report-mini-chart">
                <h3>Session Status Distribution</h3>
                <div
                  className="report-mini-chart-bar"
                  role="img"
                  aria-label="Session status distribution"
                >
                  <span
                    className="segment pending"
                    style={{
                      width: `${detailSessionsTotal > 0 ? (campaignDetail.sessions.pending / detailSessionsTotal) * 100 : 0}%`,
                    }}
                  />
                  <span
                    className="segment active"
                    style={{
                      width: `${detailSessionsTotal > 0 ? (campaignDetail.sessions.active / detailSessionsTotal) * 100 : 0}%`,
                    }}
                  />
                  <span
                    className="segment completed"
                    style={{
                      width: `${detailSessionsTotal > 0 ? (campaignDetail.sessions.completed / detailSessionsTotal) * 100 : 0}%`,
                    }}
                  />
                  <span
                    className="segment abandoned"
                    style={{
                      width: `${detailSessionsTotal > 0 ? (campaignDetail.sessions.abandoned / detailSessionsTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="report-mini-chart-legend">
                  <span>Pending: {campaignDetail.sessions.pending}</span>
                  <span>Active: {campaignDetail.sessions.active}</span>
                  <span>Completed: {campaignDetail.sessions.completed}</span>
                  <span>Abandoned: {campaignDetail.sessions.abandoned}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === "agents" ? (
        <>
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
          <PaginationControls
            page={agentsPage}
            limit={REPORTS_PAGE_SIZE}
            total={state.agentsMeta?.total}
            currentCount={state.agents.length}
            loading={loading}
            onPageChange={setAgentsPage}
          />
        </>
      ) : null}

      {activeTab === "export" ? (
        <div className="crud-form">
          <h2>Export Center</h2>
          <div className="page-actions">
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
          <p className="status-note">
            Campaign detail export requires selecting a campaign in the Campaign
            Detail tab.
          </p>
        </div>
      ) : null}
    </section>
  );
}
