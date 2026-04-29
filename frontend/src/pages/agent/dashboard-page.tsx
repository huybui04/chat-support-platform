import { useEffect, useState } from "react";
import { getMyTeamMembers, type User } from "../../services/admin-api";
import { useAgentRealtime } from "../../store/use-agent-realtime";

export function AgentDashboardPage() {
  const {
    pendingSessions,
    assignedSessions,
    metrics,
    connectionState,
    agentAvgHandlingSecondsMap,
  } = useAgentRealtime();

  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setTeamLoading(true);
    getMyTeamMembers()
      .then((members) => {
        if (mounted) {
          setTeamMembers(members);
        }
      })
      .catch(() => {
        // silently ignore – table will just show empty
      })
      .finally(() => {
        if (mounted) {
          setTeamLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const teamRows = buildTeamRows(
    teamMembers,
    assignedSessions,
    agentAvgHandlingSecondsMap,
  );
  const campaigns = buildCampaigns(pendingSessions, assignedSessions);

  return (
    <main className="agent-dashboard-page">
      <div className="agent-dashboard-topline" aria-hidden="true" />

      <div className="agent-dashboard-content">
        <section className="agent-kpi-grid">
          <article>
            <h2>Total In Queue</h2>
            <p>{metrics.pendingCount}</p>
          </article>
          <article>
            <h2>Pending Interactions</h2>
            <p>{metrics.pendingCount}</p>
          </article>
          <article>
            <h2>Total Handling Time</h2>
            <p>{formatDuration(metrics.totalHandlingSeconds ?? 0)}</p>
          </article>
          <article>
            <h2>Average Handling Time</h2>
            <p>{formatDuration(metrics.avgHandlingSeconds ?? 0)}</p>
          </article>
        </section>

        <div className="agent-dashboard-lower-grid">
          <section className="agent-team-panel">
            <header>
              <h3>My Team</h3>
              <span className={`status-badge ${connectionState}`}>
                {connectionState}
              </span>
            </header>

            <div className="agent-team-table-wrap">
              <table className="data-table agent-team-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Handled</th>
                    <th>Email Handling</th>
                    <th>Chat Handling</th>
                    <th>Social Handling</th>
                    <th>Email Handled</th>
                    <th>Chat Handled</th>
                    <th>Social Handled</th>
                    <th>Average Handling Time</th>
                    <th>Average chat handling time</th>
                    <th>Average email handling time</th>
                    <th>Average social handling time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!teamLoading && teamRows.length === 0 ? (
                    <tr>
                      <td colSpan={13}>
                        <p className="status-note">No team members found.</p>
                      </td>
                    </tr>
                  ) : null}

                  {teamRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.handled}</td>
                      <td>-</td>
                      <td>{row.handled}</td>
                      <td>-</td>
                      <td>0</td>
                      <td>{row.handled}</td>
                      <td>0</td>
                      <td>{row.avgHandlingTime}</td>
                      <td>{row.avgHandlingTime}</td>
                      <td>-</td>
                      <td>-</td>
                      <td>
                        <span
                          className={`status-badge ${row.isOnline ? "online" : "offline"}`}
                        >
                          {row.isOnline ? "Online" : "Offline"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="agent-team-footer">
              <span>Show</span>
              <select value="10" onChange={() => {}} aria-label="Rows per page">
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
              <span>Items</span>
              <div className="agent-team-pagination">1 of 1</div>
            </footer>
          </section>

          <aside className="agent-campaigns-panel">
            <header>
              <h3>My Campaigns</h3>
              <button type="button" className="inline-link-button">
                ...
              </button>
            </header>

            <ul>
              {campaigns.length === 0 ? (
                <li>No active campaign</li>
              ) : (
                campaigns.map((campaign) => <li key={campaign}>{campaign}</li>)
              )}
            </ul>

            <div className="agent-campaigns-meta">
              <span>Assigned: {metrics.assignedCount}</span>
              <span>Online agents: {metrics.onlineAgents}</span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

type TeamRow = {
  id: string;
  name: string;
  handled: number;
  avgHandlingTime: string;
  isOnline: boolean;
};

function buildTeamRows(
  members: User[],
  sessions: Array<{
    id: string;
    agentId?: string | null;
    agentName?: string | null;
  }>,
  agentAvgMap: Record<string, number> = {},
): TeamRow[] {
  // Build a lookup of session counts per agentId
  const sessionCountMap = new Map<string, number>();
  for (const session of sessions) {
    if (session.agentId) {
      sessionCountMap.set(
        session.agentId,
        (sessionCountMap.get(session.agentId) ?? 0) + 1,
      );
    }
  }

  return members.map((member) => ({
    id: member.id,
    name: member.fullName,
    handled: sessionCountMap.get(member.id) ?? 0,
    avgHandlingTime: formatDuration(agentAvgMap[member.id] ?? 0),
    isOnline: member.isOnline,
  }));
}

function buildCampaigns(
  pending: Array<{ campaignName?: string | null }>,
  assigned: Array<{ campaignName?: string | null }>,
) {
  const names = new Set<string>();

  for (const item of [...pending, ...assigned]) {
    if (item.campaignName?.trim()) {
      names.add(item.campaignName.trim());
    }
  }

  return Array.from(names).slice(0, 8);
}

function formatDuration(totalSeconds: number) {
  const secs = Math.max(0, Math.round(totalSeconds ?? 0));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}
