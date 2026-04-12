import { useEffect, useState } from "react";

import { getContacts, type Contact } from "../../services/admin-api";
import type { ApiMeta } from "../../types/api";

export function AdminContactsPage() {
  const [items, setItems] = useState<Contact[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getContacts({ page: 1, limit: 20 });
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
            : "Failed to load contacts",
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
      <h1>Contacts</h1>
      <p>Contact records used for campaign imports and assignments.</p>

      <p className="status-note">
        {meta?.total !== undefined ? `Total contacts: ${meta.total}` : null}
      </p>
      {loading ? <p className="status-note">Loading contacts...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="data-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>WhatsApp ID</th>
            </tr>
          </thead>
          <tbody>
            {items.map((contact) => (
              <tr key={contact.id}>
                <td>{contact.fullName}</td>
                <td>{contact.email ?? "-"}</td>
                <td>{contact.phone ?? "-"}</td>
                <td>{contact.whatsappId ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
