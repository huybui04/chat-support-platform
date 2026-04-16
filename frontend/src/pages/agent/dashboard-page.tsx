import { EventLog } from "../../components/agent/event-log";
import { MetricsCards } from "../../components/agent/metrics-cards";
import { SessionLists } from "../../components/agent/session-lists";
import { StatusLegend } from "../../components/common/status-legend";
import { useAgentRealtime } from "../../store/use-agent-realtime";

export function AgentDashboardPage() {
  const { pendingSessions, assignedSessions, metrics, logs, connectionState } =
    useAgentRealtime();

  return (
    <main className="dashboard">
      <header className="hero">
        <div>
          <p className="eyebrow">Agent Portal</p>
          <h1>Realtime Queue Monitor</h1>
          <p className="subtitle">
            Listening to /chat namespace for live session assignment and agent
            availability updates.
          </p>
        </div>
        <div className="hero-meta">
          <span className={`status-badge ${connectionState}`}>
            {connectionState}
          </span>
          <span className="status-badge online">
            Agents Online: {metrics.onlineAgents}
          </span>
          {connectionState === "reconnecting" ? (
            <span className="status-badge pending">Reconnecting...</span>
          ) : null}
        </div>
      </header>

      <StatusLegend
        items={[
          { key: "connected", label: "Connected" },
          { key: "connecting", label: "Connecting" },
          { key: "reconnecting", label: "Reconnecting" },
          { key: "disconnected", label: "Disconnected" },
          { key: "pending", label: "Pending" },
          { key: "active", label: "Active" },
        ]}
      />

      <MetricsCards
        pendingCount={metrics.pendingCount}
        assignedCount={metrics.assignedCount}
        onlineAgents={metrics.onlineAgents}
      />

      <SessionLists
        pendingSessions={pendingSessions}
        assignedSessions={assignedSessions}
      />

      <EventLog logs={logs} />
    </main>
  );
}
