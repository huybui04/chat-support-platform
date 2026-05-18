import { useEffect, useMemo, useState } from "react";

import { PaginationControls } from "../../components/common/pagination-controls";
import { getSessionMessages, type ChatMessage } from "../../services/agent-api";
import {
  getInteractionHistory,
  type InteractionSession,
} from "../../services/admin-api";
import { useAuth } from "../../store/auth-context";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

const CHANNEL_OPTIONS: Array<InteractionSession["channel"]> = [
  "web",
  "whatsapp",
  "instagram",
  "messenger",
  "gmail",
];

const STATUS_OPTIONS: Array<InteractionSession["status"]> = [
  "pending",
  "active",
  "completed",
  "abandoned",
];

export function AdminContactsPage() {
  const { role } = useAuth();
  const [items, setItems] = useState<InteractionSession[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phoneKeyword, setPhoneKeyword] = useState("");
  const [campaignKeyword, setCampaignKeyword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [channelFilter, setChannelFilter] = useState<
    InteractionSession["channel"] | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    InteractionSession["status"] | "all"
  >("all");
  const [viewingItem, setViewingItem] = useState<InteractionSession | null>(
    null,
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getInteractionHistory({
          page,
          limit: PAGE_SIZE,
          status: statusFilter === "all" ? undefined : statusFilter,
          // For agent users, show interaction history for campaigns assigned to their team
          visibilityScope: role === "agent" ? "team" : undefined,
        });

        if (!mounted) {
          return;
        }

        setItems(result.items);
        setMeta(result.meta);
      } catch (caughtError) {
        if (!mounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load interaction history",
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
  }, [page, role, statusFilter]);

  useEffect(() => {
    if (!viewingItem) {
      setChatMessages([]);
      setChatLoading(false);
      setChatError("");
      return;
    }

    let mounted = true;

    const run = async () => {
      setChatLoading(true);
      setChatError("");
      try {
        const result = await getSessionMessages(viewingItem.id, { limit: 100 });
        if (!mounted) {
          return;
        }

        setChatMessages(result.items);
      } catch (caughtError) {
        if (!mounted) {
          return;
        }

        setChatError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load chat history",
        );
      } finally {
        if (mounted) {
          setChatLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [viewingItem]);

  const filteredItems = useMemo(() => {
    const phoneNeedle = phoneKeyword.trim().toLowerCase();
    const campaignNeedle = campaignKeyword.trim().toLowerCase();

    return items.filter((item) => {
      if (channelFilter !== "all" && item.channel !== channelFilter) {
        return false;
      }

      const contactText =
        `${item.contactName ?? ""} ${item.contactId}`.toLowerCase();
      const campaignText = `${item.campaignName ?? ""}`.toLowerCase();

      if (phoneNeedle && !contactText.includes(phoneNeedle)) {
        return false;
      }

      if (campaignNeedle && !campaignText.includes(campaignNeedle)) {
        return false;
      }

      return true;
    });
  }, [campaignKeyword, channelFilter, items, phoneKeyword]);

  const downloadCsv = () => {
    if (filteredItems.length === 0) {
      return;
    }

    const headers = [
      "id",
      "channel",
      "agent",
      "contact",
      "campaign",
      "started_time",
      "assigned_time",
      "ended_time",
      "handling_time",
      "outcome",
    ];

    const lines = filteredItems.map((item) => {
      const started = formatDateTime(item.startedAt);
      const ended = formatDateTime(item.endedAt);

      return [
        item.id,
        item.channel,
        item.agentName ?? "Unassigned",
        item.contactName ?? item.contactId,
        item.campaignName ?? "-",
        started,
        started,
        ended,
        formatHandlingTime(item.startedAt, item.endedAt),
        toOutcomeLabel(item.status),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csvContent = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interaction-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="placeholder-page interaction-history-page">
      <p className="interaction-breadcrumb">
        Interaction History <span aria-hidden="true">›</span> All Interactions
      </p>

      <div className="interaction-toolbar">
        <button
          type="button"
          className="interaction-download-btn"
          onClick={downloadCsv}
        >
          Download
        </button>

        <input
          className="interaction-search-input"
          placeholder="Phone number/email address"
          value={phoneKeyword}
          onChange={(event) => setPhoneKeyword(event.target.value)}
        />

        <input
          className="interaction-search-input"
          placeholder="Campaign name"
          value={campaignKeyword}
          onChange={(event) => setCampaignKeyword(event.target.value)}
        />

        <button
          type="button"
          className="interaction-advanced-btn"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          Advanced search
        </button>
      </div>

      {showAdvanced ? (
        <div className="interaction-advanced-panel">
          <label>
            Channel
            <select
              value={channelFilter}
              onChange={(event) =>
                setChannelFilter(
                  event.target.value as InteractionSession["channel"] | "all",
                )
              }
            >
              <option value="all">All channels</option>
              {CHANNEL_OPTIONS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>

          <label>
            Outcome
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as InteractionSession["status"] | "all",
                )
              }
            >
              <option value="all">All outcomes</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {toOutcomeLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {loading ? <p className="status-note">Loading interactions...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="data-panel interaction-table-panel">
        <table className="data-table interaction-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Channel</th>
              <th>Agent Assigned</th>
              <th>Contact</th>
              <th>Campaign</th>
              <th>Started Time</th>
              <th>Assigned Time</th>
              <th>Ended Time</th>
              <th>Handling Time</th>
              <th>Outcome</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <p className="status-note">No interactions found.</p>
                </td>
              </tr>
            ) : null}

            {filteredItems.map((item) => {
              const started = formatDateTime(item.startedAt);
              const ended = formatDateTime(item.endedAt);

              return (
                <tr key={item.id}>
                  <td>
                    <span className="interaction-cell" title={item.id}>
                      {shortId(item.id)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge channel-${item.channel}`}>
                      {item.channel}
                    </span>
                  </td>
                  <td>
                    <span
                      className="interaction-cell"
                      title={item.agentName ?? "Unassigned"}
                    >
                      {item.agentName ?? "Unassigned"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="interaction-cell"
                      title={item.contactName ?? "-"}
                    >
                      {item.contactName ?? "-"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="interaction-cell"
                      title={item.campaignName ?? "-"}
                    >
                      {item.campaignName ?? "-"}
                    </span>
                  </td>
                  <td>
                    <span className="interaction-cell" title={started}>
                      {started}
                    </span>
                  </td>
                  <td>
                    <span className="interaction-cell" title={started}>
                      {started}
                    </span>
                  </td>
                  <td>
                    <span className="interaction-cell" title={ended}>
                      {ended}
                    </span>
                  </td>
                  <td>
                    <span
                      className="interaction-cell"
                      title={formatHandlingTime(item.startedAt, item.endedAt)}
                    >
                      {formatHandlingTime(item.startedAt, item.endedAt)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.status}`}>
                      {toOutcomeLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary interaction-view-btn"
                      onClick={() => setViewingItem(item)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        limit={PAGE_SIZE}
        total={meta?.total}
        currentCount={items.length}
        loading={loading}
        onPageChange={setPage}
      />

      {viewingItem ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Interaction detail"
          onClick={() => setViewingItem(null)}
        >
          <div
            className="confirm-dialog interaction-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Chat History</h3>

            <div className="interaction-chat-history">
              <p className="status-note">
                Session ID: <strong>{shortId(viewingItem.id)}</strong>
              </p>

              {chatLoading ? (
                <p className="status-note">Loading chat history...</p>
              ) : null}

              {chatError ? <p className="error-note">{chatError}</p> : null}

              {!chatLoading && !chatError && chatMessages.length === 0 ? (
                <p className="status-note">No messages in this interaction.</p>
              ) : null}

              {!chatLoading && !chatError && chatMessages.length > 0 ? (
                <div className="interaction-chat-thread">
                  {chatMessages.map((message) => (
                    <article
                      key={message.id}
                      className={`interaction-chat-bubble sender-${message.senderType}`}
                    >
                      <header>
                        <strong>{toSenderLabel(message.senderType)}</strong>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </header>
                      <p>{message.content}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="confirm-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setViewingItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function toOutcomeLabel(status: InteractionSession["status"]) {
  if (status === "pending") return "Pending";
  if (status === "active") return "In progress";
  if (status === "completed") return "Resolved";
  return "Abandoned";
}

function formatDateTime(input: string | null) {
  if (!input) {
    return "-";
  }

  return new Date(input).toLocaleString();
}

function formatHandlingTime(startedAt: string | null, endedAt: string | null) {
  if (!startedAt || !endedAt) {
    return "-";
  }

  const durationMs =
    new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "-";
  }

  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours}h ${remainMinutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function toSenderLabel(senderType: ChatMessage["senderType"]) {
  if (senderType === "agent") {
    return "Agent";
  }

  if (senderType === "customer") {
    return "Customer";
  }

  return "System";
}
