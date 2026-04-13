import { useEffect, useMemo, useState } from "react";

import { PaginationControls } from "../../components/common/pagination-controls";
import { StatusLegend } from "../../components/common/status-legend";
import { useAuth } from "../../store/auth-context";
import { useAdminPresence } from "../../store/use-admin-presence";
import { getAgents, type User } from "../../services/admin-api";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

export function AdminAgentsPage() {
  const { token } = useAuth();
  const { socketState, agentStatuses } = useAdminPresence(token);
  const [items, setItems] = useState<User[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const effectiveItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        isOnline: agentStatuses[item.id] ?? item.isOnline,
      })),
    [agentStatuses, items],
  );

  const filteredItems = useMemo(() => {
    if (filter === "all") {
      return effectiveItems;
    }

    const expectOnline = filter === "online";
    return effectiveItems.filter((item) => item.isOnline === expectOnline);
  }, [effectiveItems, filter]);

  const onlineCount = useMemo(
    () => effectiveItems.filter((item) => item.isOnline).length,
    [effectiveItems],
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getAgents({ page, limit: PAGE_SIZE });
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
            : "Failed to load agents",
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
  }, [page]);

  return (
    <section className="placeholder-page">
      <h1>Agent Management</h1>
      <p>Agent roster and online/active controls from users endpoint.</p>

      <p className="status-note">
        {meta?.total !== undefined ? `Total agents: ${meta.total}` : null}
      </p>
      <p className="status-note with-badges">
        Realtime presence:
        <span className={`status-badge ${socketState}`}>{socketState}</span>
        <span>Online agents:</span>
        <span className="status-badge online">{onlineCount}</span>
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
      {loading ? <p className="status-note">Loading agents...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="page-actions">
        <button
          type="button"
          className={filter === "all" ? "" : "secondary"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={filter === "online" ? "" : "secondary"}
          onClick={() => setFilter("online")}
        >
          Online
        </button>
        <button
          type="button"
          className={filter === "offline" ? "" : "secondary"}
          onClick={() => setFilter("offline")}
        >
          Offline
        </button>
      </div>

      <div className="data-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Online</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((agent) => {
              const online = agent.isOnline;
              return (
                <tr key={agent.id}>
                  <td>{agent.fullName}</td>
                  <td>{agent.email}</td>
                  <td>
                    <span
                      className={`status-badge ${online ? "online" : "offline"}`}
                    >
                      {online ? "online" : "offline"}
                    </span>
                  </td>
                  <td>{agent.isActive ? "active" : "disabled"}</td>
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
    </section>
  );
}
