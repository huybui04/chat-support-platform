import { useMemo, useState } from "react";

import type { RealtimeLogItem } from "../../store/use-agent-realtime";

type EventLogProps = {
  logs: RealtimeLogItem[];
};

export function EventLog({ logs }: EventLogProps) {
  const [filter, setFilter] = useState<"important" | "all">("important");

  const visibleLogs = useMemo(() => {
    if (filter === "all") {
      return logs;
    }

    const importantEvents = new Set([
      "connect",
      "disconnect",
      "reconnecting",
      "reconnect_attempt",
      "reconnect_failed",
      "error",
      "snapshot_loaded",
      "snapshot_failed",
      "new_session_pending",
      "session_assigned",
      "agents_online_snapshot",
      "agent_status_changed",
    ]);

    return logs.filter((log) => importantEvents.has(log.event));
  }, [filter, logs]);

  return (
    <section className="logs panel">
      <h3>Event Stream</h3>
      <div className="event-log-filters">
        <button
          type="button"
          className={filter === "important" ? "" : "secondary"}
          onClick={() => setFilter("important")}
        >
          Important
        </button>
        <button
          type="button"
          className={filter === "all" ? "" : "secondary"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>
      <ul>
        {visibleLogs.map((log) => (
          <li key={log.id}>
            <span>{log.at}</span>
            <strong>{log.event}</strong>
            <code>{log.payload}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
