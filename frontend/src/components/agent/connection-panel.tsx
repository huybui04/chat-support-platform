type ConnectionPanelProps = {
  wsUrl: string;
  token: string;
  connectionState: string;
  onWsUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function ConnectionPanel({
  wsUrl,
  token,
  connectionState,
  onWsUrlChange,
  onTokenChange,
  onConnect,
  onDisconnect,
}: ConnectionPanelProps) {
  return (
    <section className="connection-panel">
      <label>
        WebSocket URL
        <input
          value={wsUrl}
          onChange={(event) => onWsUrlChange(event.target.value)}
          placeholder="http://localhost:3001"
        />
      </label>

      <label>
        JWT Token
        <input
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder="Paste access token"
        />
      </label>

      <div className="actions">
        <button onClick={onConnect} type="button">
          Connect
        </button>
        <button onClick={onDisconnect} type="button" className="secondary">
          Disconnect
        </button>
        <span className={`status-badge ${connectionState}`}>
          {connectionState}
        </span>
      </div>
    </section>
  );
}
