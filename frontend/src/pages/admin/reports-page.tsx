import { useEffect, useMemo, useState } from "react";
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

function buildSparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return "";
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

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
  const [channelFilter, setChannelFilter] = useState<
    "all" | CampaignReport["channel"]
  >("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [campaignFilterId, setCampaignFilterId] = useState("all");
  const [agentFilterId, setAgentFilterId] = useState("all");
  const [overviewKeyword, setOverviewKeyword] = useState("");
  const [campaignDetail, setCampaignDetail] =
    useState<CampaignDetailReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [exportBusy, setExportBusy] = useState<ReportsExportKind | "">("");
  const [exportError, setExportError] = useState("");
  const [exportFormat, setExportFormat] = useState<ReportsExportFormat>("csv");
  const exportFormatLabel = exportFormat.toUpperCase();
  const windowLabel =
    windowFilter === "24h"
      ? "Last 24 hours"
      : windowFilter === "7d"
        ? "Last 7 days"
        : windowFilter === "30d"
          ? "Last 30 days"
          : "All time";
  const channelLabel = channelFilter === "all" ? "All channels" : channelFilter;
  const { totalSessions, totalCompleted, totalContacts } = useMemo(() => {
    return state.campaigns.reduce(
      (acc, campaign) => {
        const campaignSessions =
          campaign.sessions.pending +
          campaign.sessions.active +
          campaign.sessions.completed +
          campaign.sessions.abandoned;
        acc.totalSessions += campaignSessions;
        acc.totalCompleted += campaign.sessions.completed;
        acc.totalContacts += campaign.totalContacts;
        return acc;
      },
      {
        totalSessions: 0,
        totalCompleted: 0,
        totalContacts: 0,
      },
    );
  }, [state.campaigns]);
  const completionRate = totalSessions
    ? Math.round((totalCompleted / totalSessions) * 100)
    : 0;
  const totalCampaigns = state.campaignsMeta?.total ?? state.campaigns.length;
  const totalAgents = state.agentsMeta?.total ?? state.agents.length;
  const onlineAgents = useMemo(
    () =>
      state.agents.reduce(
        (count, agent) =>
          count + ((agentStatuses[agent.agentId] ?? agent.isOnline) ? 1 : 0),
        0,
      ),
    [agentStatuses, state.agents],
  );
  const filteredCampaigns = state.campaigns.filter((campaign) => {
    if (
      campaignFilterId !== "all" &&
      campaign.campaignId !== campaignFilterId
    ) {
      return false;
    }

    const keyword = overviewKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return campaign.name.toLowerCase().includes(keyword);
  });
  const filteredAgents = state.agents.filter((agent) => {
    if (agentFilterId !== "all" && agent.agentId !== agentFilterId) {
      return false;
    }

    return true;
  });
  const trendValues = useMemo(() => {
    const source = filteredCampaigns.length
      ? filteredCampaigns
      : state.campaigns;
    return source.map(
      (campaign) =>
        campaign.sessions.pending +
        campaign.sessions.active +
        campaign.sessions.completed +
        campaign.sessions.abandoned,
    );
  }, [filteredCampaigns, state.campaigns]);
  const trendPath = useMemo(
    () => buildSparklinePath(trendValues, 160, 36),
    [trendValues],
  );
  const trendAreaPath = useMemo(() => {
    if (!trendPath) {
      return "";
    }

    return `${trendPath} L 160,36 L 0,36 Z`;
  }, [trendPath]);

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
            channel: channelFilter === "all" ? undefined : channelFilter,
          }),
          getAgentsReport({
            page: agentsPage,
            limit: REPORTS_PAGE_SIZE,
            window: windowFilter,
            channel: channelFilter === "all" ? undefined : channelFilter,
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
  }, [agentsPage, campaignsPage, channelFilter, windowFilter]);

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
          channel: channelFilter === "all" ? undefined : channelFilter,
        }),
        getAgentsReport({
          page: agentsPage,
          limit: REPORTS_PAGE_SIZE,
          window: windowFilter,
          channel: channelFilter === "all" ? undefined : channelFilter,
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
  }, [
    agentsPage,
    campaignsPage,
    channelFilter,
    queueEventTick,
    token,
    windowFilter,
  ]);

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
        channel:
          kind === "campaigns" || kind === "agents" || kind === "sessions"
            ? channelFilter === "all"
              ? undefined
              : channelFilter
            : undefined,
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
    <section className="placeholder-page reports-page">
      <header className="reports-hero">
        <div className="reports-hero-content">
          <p className="eyebrow">Analytics workspace</p>
          <h1>Reports</h1>
          <p className="subtitle">
            Track campaign health, agent performance, and export-ready snapshots
            in one unified view.
          </p>
          <div className="reports-hero-badges">
            <span className={`status-badge ${socketState}`}>{socketState}</span>
            <span className="reports-chip">{windowLabel}</span>
            <span className="reports-chip">{channelLabel}</span>
          </div>
        </div>
        <div className="reports-hero-meta">
          <div className="reports-meta-card">
            <span className="reports-meta-label">Online agents</span>
            <strong>
              {onlineAgents} / {totalAgents}
            </strong>
          </div>
          <div className="reports-meta-card">
            <span className="reports-meta-label">Last report sync</span>
            <strong>
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "-"}
            </strong>
          </div>
          <div className="reports-meta-card">
            <span className="reports-meta-label">Last queue event</span>
            <strong>
              {lastQueueEventAt
                ? new Date(lastQueueEventAt).toLocaleTimeString()
                : "-"}
            </strong>
          </div>
        </div>
      </header>

      <div className="reports-filter-bar">
        <div className="reports-filter-group">
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
          <label>
            Channel
            <select
              value={channelFilter}
              onChange={(event) => {
                setCampaignsPage(1);
                setChannelFilter(
                  event.target.value as "all" | CampaignReport["channel"],
                );
              }}
            >
              <option value="all">All channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="gmail">Gmail</option>
            </select>
          </label>
        </div>
        {activeTab === "overview" ? (
          <div className="reports-filter-search">
            <label>
              Search campaigns
              <input
                placeholder="Filter campaigns by name"
                value={overviewKeyword}
                onChange={(event) => setOverviewKeyword(event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="reports-filter-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => setShowAdvancedFilters((value) => !value)}
        >
          {showAdvancedFilters ? "Hide advanced filters" : "Advanced filters"}
        </button>
        {(campaignFilterId !== "all" || agentFilterId !== "all") && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setCampaignFilterId("all");
              setAgentFilterId("all");
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {showAdvancedFilters ? (
        <div className="reports-advanced-panel">
          {activeTab === "overview" ? (
            <label>
              Campaign focus
              <select
                value={campaignFilterId}
                onChange={(event) => {
                  setCampaignsPage(1);
                  setCampaignFilterId(event.target.value);
                }}
              >
                <option value="all">All campaigns</option>
                {state.campaigns.map((campaign) => (
                  <option key={campaign.campaignId} value={campaign.campaignId}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {activeTab === "agents" ? (
            <label>
              Agent focus
              <select
                value={agentFilterId}
                onChange={(event) => {
                  setAgentsPage(1);
                  setAgentFilterId(event.target.value);
                }}
              >
                <option value="all">All agents</option>
                {state.agents.map((agent) => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {activeTab !== "overview" && activeTab !== "agents" ? (
            <p className="status-note">
              Advanced filters are available in Overview and Agent Performance.
            </p>
          ) : null}
        </div>
      ) : null}

      {exportError ? <p className="error-note">{exportError}</p> : null}

      <div className="admin-kpi-grid reports-kpi-grid">
        <article>
          <h3>Active campaigns</h3>
          <p>{totalCampaigns}</p>
        </article>
        <article>
          <h3>Total contacts</h3>
          <p>{totalContacts}</p>
        </article>
        <article>
          <h3>Total sessions</h3>
          <p>{totalSessions}</p>
        </article>
        <article>
          <h3>Completion rate</h3>
          <p>{completionRate}%</p>
        </article>
        <article className="reports-trend-card">
          <h3>Session trend</h3>
          {trendPath ? (
            <div className="reports-sparkline">
              <svg viewBox="0 0 160 36" aria-hidden="true">
                <path className="reports-sparkline-area" d={trendAreaPath} />
                <path className="reports-sparkline-line" d={trendPath} />
              </svg>
              <span className="reports-sparkline-label">
                {trendValues.length} campaigns
              </span>
            </div>
          ) : (
            <p className="status-note">No trend data yet.</p>
          )}
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
          <div className="data-panel reports-table-panel">
            <h2>Campaign Overview</h2>
            <table className="data-table reports-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Channel</th>
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
                    <td colSpan={7}>
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
                    <td>
                      <span
                        className={`status-badge channel-${campaign.channel}`}
                      >
                        {campaign.channel}
                      </span>
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
        <div className="data-panel reports-detail-panel">
          <h2>Campaign Detail</h2>
          <div className="page-actions reports-detail-actions">
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
              <div className="reports-detail-grid">
                <div className="admin-kpi-grid reports-kpi-grid">
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
                    <p>
                      {Math.round(campaignDetail.avgSessionDurationSeconds)}
                    </p>
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
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === "agents" ? (
        <>
          <div className="data-panel reports-table-panel">
            <h2>Agent Performance</h2>
            <table className="data-table reports-table">
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
                {filteredAgents.map((agent) => (
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
            currentCount={filteredAgents.length}
            loading={loading}
            onPageChange={setAgentsPage}
          />
        </>
      ) : null}

      {activeTab === "export" ? (
        <div className="crud-form reports-export-panel">
          <h2>Export Center</h2>
          <p className="status-note">
            Export snapshots for leadership updates, data audits, and historical
            analysis.
          </p>
          <div className="page-actions reports-export-actions">
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
          <div className="page-actions reports-export-actions">
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
