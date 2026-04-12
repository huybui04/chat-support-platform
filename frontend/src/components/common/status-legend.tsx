type LegendItem = {
  key: string;
  label: string;
};

const defaultItems: LegendItem[] = [
  { key: "connected", label: "Connected" },
  { key: "connecting", label: "Connecting" },
  { key: "disconnected", label: "Disconnected" },
  { key: "online", label: "Online" },
  { key: "offline", label: "Offline" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "typing", label: "Typing" },
];

type StatusLegendProps = {
  title?: string;
  items?: LegendItem[];
};

export function StatusLegend({
  title = "Status legend",
  items = defaultItems,
}: StatusLegendProps) {
  return (
    <div className="status-legend" aria-label={title}>
      <span className="status-legend-title">{title}:</span>
      {items.map((item) => (
        <span key={item.key} className={`status-badge ${item.key}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
