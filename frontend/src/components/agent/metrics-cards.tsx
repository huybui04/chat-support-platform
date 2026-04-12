type MetricsCardsProps = {
  pendingCount: number;
  assignedCount: number;
  onlineAgents: number;
};

export function MetricsCards({
  pendingCount,
  assignedCount,
  onlineAgents,
}: MetricsCardsProps) {
  return (
    <section className="metrics-grid">
      <article>
        <h2>Pending Sessions</h2>
        <p>{pendingCount}</p>
      </article>
      <article>
        <h2>Assigned Sessions</h2>
        <p>{assignedCount}</p>
      </article>
      <article>
        <h2>Agents Online</h2>
        <p>{onlineAgents}</p>
      </article>
    </section>
  );
}
