import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
// import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import { RowActionButtons } from "../../components/common/row-action-buttons";
import { StatusLegend } from "../../components/common/status-legend";
import { useAuth } from "../../store/auth-context";
import { useToast } from "../../store/toast-context";
import { useCrudActions } from "../../store/use-crud-actions";
import { useAdminPresence } from "../../store/use-admin-presence";
import {
  // createAgent,
  deleteAgent,
  getAgents,
  updateAgent,
  type User,
} from "../../services/admin-api";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

type AgentForm = {
  keycloakId: string;
  fullName: string;
  email: string;
  isActive: boolean;
};

// const initialCreateForm: AgentForm = {
//   keycloakId: "",
//   fullName: "",
//   email: "",
//   isActive: true,
// };

const initialEditForm: Omit<AgentForm, "keycloakId"> = {
  fullName: "",
  email: "",
  isActive: true,
};

export function AdminAgentsPage() {
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();
  const { socketState, agentStatuses } = useAdminPresence(token);
  const [items, setItems] = useState<User[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  // const [createForm, setCreateForm] = useState<AgentForm>(initialCreateForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [agentIdToDelete, setAgentIdToDelete] = useState<string | null>(null);
  // const { creating, savingId, deleting, runCreate, runSave, runDelete } =
  //   useCrudActions();
  const { savingId, deleting, runSave, runDelete } = useCrudActions();

  const effectiveItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        isOnline: agentStatuses[item.id] ?? item.isOnline,
      })),
    [agentStatuses, items],
  );

  const filteredItems = useMemo(() => {
    if (filter === "all") {
      return effectiveItems;
    }

    const expectOnline = filter === "online";
    return effectiveItems.filter((item) => item.isOnline === expectOnline);
  }, [effectiveItems, filter]);

  const onlineCount = useMemo(
    () => effectiveItems.filter((item) => item.isOnline).length,
    [effectiveItems],
  );

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAgents({ page, limit: PAGE_SIZE });
      setItems(result.items);
      setMeta(result.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load agents",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // const handleCreate = async () => {
  //   if (!createForm.fullName.trim() || !createForm.email.trim()) {
  //     showError("Full name and email are required");
  //     return;
  //   }
  //   if (!createForm.keycloakId.trim()) {
  //     showError("Keycloak ID is required");
  //     return;
  //   }

  //   const created = await runCreate(
  //     async () =>
  //       createAgent({
  //         keycloakId: createForm.keycloakId.trim(),
  //         fullName: createForm.fullName.trim(),
  //         email: createForm.email.trim(),
  //         isActive: createForm.isActive,
  //       }),
  //     "Failed to create agent",
  //   );

  //   if (created) {
  //     setCreateForm(initialCreateForm);
  //     showSuccess("Agent created successfully");
  //     await loadAgents();
  //   }
  // };

  const startEdit = (agent: User) => {
    setEditingId(agent.id);
    setEditForm({
      fullName: agent.fullName,
      email: agent.email,
      isActive: agent.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialEditForm);
  };

  const saveEdit = async (id: string) => {
    if (!editForm.fullName.trim() || !editForm.email.trim()) {
      showError("Full name and email are required");
      return;
    }

    const updated = await runSave(
      id,
      async () =>
        updateAgent(id, {
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          isActive: editForm.isActive,
        }),
      "Failed to update agent",
    );

    if (updated) {
      cancelEdit();
      showSuccess("Agent updated successfully");
      await loadAgents();
    }
  };

  const removeAgent = async () => {
    if (!agentIdToDelete) {
      return;
    }

    const deleted = await runDelete(
      async () => deleteAgent(agentIdToDelete),
      "Failed to remove agent",
    );

    if (deleted !== undefined) {
      showSuccess("Agent disabled successfully");
      setAgentIdToDelete(null);
      await loadAgents();
    }
  };

  return (
    <section className="placeholder-page">
      <h1>Agent Management</h1>

      <p className="status-note">
        {meta?.total !== undefined ? `Total agents: ${meta.total}` : null}
      </p>
      <p className="status-note with-badges">
        Realtime presence:
        <span className={`status-badge ${socketState}`}>{socketState}</span>
        <span>Online agents:</span>
        <span className="status-badge online">{onlineCount}</span>
      </p>
      <StatusLegend
        items={[
          { key: "connected", label: "Connected" },
          { key: "connecting", label: "Connecting" },
          { key: "disconnected", label: "Disconnected" },
          { key: "online", label: "Online" },
          { key: "offline", label: "Offline" },
        ]}
      />
      {loading ? <p className="status-note">Loading agents...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      {/* <CrudFormCard
        title="Create Agent"
        submitLabel="Create agent"
        submittingLabel="Creating..."
        submitting={creating}
        onSubmit={() => void handleCreate()}
      >
        <input
          placeholder="Keycloak ID"
          value={createForm.keycloakId}
          disabled={creating}
          onChange={(event) =>
            setCreateForm((prev) => ({
              ...prev,
              keycloakId: event.target.value,
            }))
          }
        />
        <input
          placeholder="Full name"
          value={createForm.fullName}
          disabled={creating}
          onChange={(event) =>
            setCreateForm((prev) => ({
              ...prev,
              fullName: event.target.value,
            }))
          }
        />
        <input
          placeholder="Email"
          type="email"
          value={createForm.email}
          disabled={creating}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, email: event.target.value }))
          }
        />
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={createForm.isActive}
            disabled={creating}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                isActive: event.target.checked,
              }))
            }
          />
          Active
        </label>
      </CrudFormCard> */}

      <div className="page-actions">
        <button
          type="button"
          className={filter === "all" ? "" : "secondary"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={filter === "online" ? "" : "secondary"}
          onClick={() => setFilter("online")}
        >
          Online
        </button>
        <button
          type="button"
          className={filter === "offline" ? "" : "secondary"}
          onClick={() => setFilter("offline")}
        >
          Offline
        </button>
      </div>

      <div className="data-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Online</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((agent) => {
              const online = agent.isOnline;
              return (
                <tr key={agent.id}>
                  <td>
                    {editingId === agent.id ? (
                      <input
                        value={editForm.fullName}
                        disabled={savingId === agent.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            fullName: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      agent.fullName
                    )}
                  </td>
                  <td>
                    {editingId === agent.id ? (
                      <input
                        type="email"
                        value={editForm.email}
                        disabled={savingId === agent.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      agent.email
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${online ? "online" : "offline"}`}
                    >
                      {online ? "online" : "offline"}
                    </span>
                  </td>
                  <td>
                    {editingId === agent.id ? (
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          disabled={savingId === agent.id}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              isActive: event.target.checked,
                            }))
                          }
                        />
                        Active
                      </label>
                    ) : agent.isActive ? (
                      "active"
                    ) : (
                      "disabled"
                    )}
                  </td>
                  <td>
                    <RowActionButtons
                      editing={editingId === agent.id}
                      saving={savingId === agent.id}
                      deletingDisabled={deleting}
                      onSave={() => void saveEdit(agent.id)}
                      onCancel={cancelEdit}
                      onEdit={() => startEdit(agent)}
                      onDelete={() => setAgentIdToDelete(agent.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        limit={PAGE_SIZE}
        total={meta?.total}
        currentCount={items.length}
        loading={loading}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={Boolean(agentIdToDelete)}
        title="Disable agent"
        message="This action will deactivate the selected agent account."
        confirmLabel="Disable"
        confirmLoading={deleting}
        onCancel={() => setAgentIdToDelete(null)}
        onConfirm={() => void removeAgent()}
      />
    </section>
  );
}
