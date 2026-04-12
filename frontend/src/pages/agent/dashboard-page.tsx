import { ConnectionPanel } from "../../components/agent/connection-panel";
import { EventLog } from "../../components/agent/event-log";
import { MetricsCards } from "../../components/agent/metrics-cards";
import { SessionLists } from "../../components/agent/session-lists";
import { StatusLegend } from "../../components/common/status-legend";
import { useAgentRealtime } from "../../store/use-agent-realtime";

export function AgentDashboardPage() {
  const {
    wsUrl,
    setWsUrl,
    token,
    setToken,
    connectionState,
    pendingSessions,
    assignedSessions,
    metrics,
    logs,
    connect,
    disconnect,
  } = useAgentRealtime();

  return (
    <main className="dashboard">
      <header className="hero">
        <p className="eyebrow">Agent Portal</p>
        <h1>Realtime Queue Monitor</h1>
        <p className="subtitle">
          Listening to /chat namespace for live session assignment and agent
          availability updates.
        </p>
      </header>

      <ConnectionPanel
        wsUrl={wsUrl}
        token={token}
        connectionState={connectionState}
        onWsUrlChange={setWsUrl}
        onTokenChange={setToken}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <StatusLegend
        items={[
          { key: "connected", label: "Connected" },
          { key: "connecting", label: "Connecting" },
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
