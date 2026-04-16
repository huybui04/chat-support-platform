import { useMemo, useState } from "react";

import { PaginationControls } from "../common/pagination-controls";
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
  const pageSize = 6;
  const [pendingPage, setPendingPage] = useState(1);
  const [assignedPage, setAssignedPage] = useState(1);

  const pendingTotalPages = Math.max(
    1,
    Math.ceil(pendingSessions.length / pageSize),
  );
  const assignedTotalPages = Math.max(
    1,
    Math.ceil(assignedSessions.length / pageSize),
  );

  const pendingPageSafe = Math.min(pendingPage, pendingTotalPages);
  const assignedPageSafe = Math.min(assignedPage, assignedTotalPages);

  const pendingVisible = useMemo(() => {
    const start = (pendingPageSafe - 1) * pageSize;
    return pendingSessions.slice(start, start + pageSize);
  }, [pendingPageSafe, pendingSessions]);

  const assignedVisible = useMemo(() => {
    const start = (assignedPageSafe - 1) * pageSize;
    return assignedSessions.slice(start, start + pageSize);
  }, [assignedPageSafe, assignedSessions]);

  return (
    <section className="panel-grid">
      <article className="panel">
        <h3>Recent Pending</h3>
        <ul>
          {pendingVisible.map((session) => (
            <li key={session.id}>
              <span>{session.id}</span>
              <span>{session.campaignName ?? "-"}</span>
            </li>
          ))}
        </ul>
        <PaginationControls
          page={pendingPageSafe}
          limit={pageSize}
          total={pendingSessions.length}
          currentCount={pendingVisible.length}
          onPageChange={(next) =>
            setPendingPage(Math.max(1, Math.min(next, pendingTotalPages)))
          }
        />
      </article>

      <article className="panel">
        <h3>Recent Assigned</h3>
        <ul>
          {assignedVisible.map((session) => (
            <li key={`${session.id}-${session.agentId ?? "none"}`}>
              <span>{session.id}</span>
              <span>
                {session.agentName ?? session.agentId ?? "unassigned"} |{" "}
                {session.campaignName ?? "-"}
              </span>
            </li>
          ))}
        </ul>
        <PaginationControls
          page={assignedPageSafe}
          limit={pageSize}
          total={assignedSessions.length}
          currentCount={assignedVisible.length}
          onPageChange={(next) =>
            setAssignedPage(Math.max(1, Math.min(next, assignedTotalPages)))
          }
        />
      </article>
    </section>
  );
}
