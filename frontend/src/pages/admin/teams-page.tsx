import { useEffect, useState } from "react";

import { getTeams, type Team } from "../../services/admin-api";
import type { ApiMeta } from "../../types/api";

export function AdminTeamsPage() {
  const [items, setItems] = useState<Team[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getTeams({ page: 1, limit: 20 });
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
            : "Failed to load teams",
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
      <h1>Team Management</h1>
      <p>Current team registry from backend team module.</p>

      <p className="status-note">
        {meta?.total !== undefined ? `Total teams: ${meta.total}` : null}
      </p>
      {loading ? <p className="status-note">Loading teams...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="data-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {items.map((team) => (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>{team.description ?? "-"}</td>
                <td>{new Date(team.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
