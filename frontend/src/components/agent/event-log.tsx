import type { RealtimeLogItem } from "../../store/use-agent-realtime";

type EventLogProps = {
  logs: RealtimeLogItem[];
};

export function EventLog({ logs }: EventLogProps) {
  return (
    <section className="logs panel">
      <h3>Event Stream</h3>
      <ul>
        {logs.map((log) => (
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
