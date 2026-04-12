import { useEffect, useState } from "react";

import { getCampaigns, type Campaign } from "../../services/admin-api";
import type { ApiMeta } from "../../types/api";

export function AdminCampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getCampaigns({ page: 1, limit: 20 });
        if (!mounted) {
          return;
        }
        setItems(result.items);
        setMeta(result.meta);
      } catch (caughtError) {
        if (!mounted) {
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load campaigns",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="placeholder-page">
      <h1>Campaign Management</h1>
      <p>Campaign list from backend with status and channel visibility.</p>

      <p className="status-note">
        {meta?.total !== undefined ? `Total campaigns: ${meta.total}` : null}
      </p>
      {loading ? <p className="status-note">Loading campaigns...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="data-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Channel</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {items.map((campaign) => (
              <tr key={campaign.id}>
                <td>{campaign.name}</td>
                <td>{campaign.status}</td>
                <td>{campaign.channel}</td>
                <td>{campaign.startDate ?? "-"}</td>
                <td>{campaign.endDate ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
