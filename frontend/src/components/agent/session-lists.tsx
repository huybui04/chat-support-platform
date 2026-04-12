import type {
  SessionAssignedPayload,
  SessionPendingPayload,
} from "../../types/chat-events";

type SessionListsProps = {
  pendingSessions: SessionPendingPayload[];
  assignedSessions: SessionAssignedPayload[];
};

export function SessionLists({
  pendingSessions,
  assignedSessions,
}: SessionListsProps) {
  return (
    <section className="panel-grid">
      <article className="panel">
        <h3>Recent Pending</h3>
        <ul>
          {pendingSessions.slice(0, 8).map((session) => (
            <li key={session.id}>{session.id}</li>
          ))}
        </ul>
      </article>

      <article className="panel">
        <h3>Recent Assigned</h3>
        <ul>
          {assignedSessions.slice(0, 8).map((session) => (
            <li key={`${session.id}-${session.agentId ?? "none"}`}>
              <span>{session.id}</span>
              <span>{session.agentId ?? "unassigned"}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
