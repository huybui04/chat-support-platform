import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import {
  createTeam,
  deleteTeam,
  getCurrentUser,
  getTeams,
  type Team,
} from "../../services/admin-api";
import { useToast } from "../../store/toast-context";
import { useCrudActions } from "../../store/use-crud-actions";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

type TeamForm = {
  name: string;
  description: string;
};

const initialForm: TeamForm = {
  name: "",
  description: "",
};

export function AdminTeamsPage() {
  const { showError, showSuccess } = useToast();
  const [items, setItems] = useState<Team[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState<TeamForm>(initialForm);
  const [showCreate, setShowCreate] = useState(false);
  const [teamIdToDelete, setTeamIdToDelete] = useState<string | null>(null);
  const { creating, deleting, runCreate, runDelete } = useCrudActions();

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTeams({ page, limit: PAGE_SIZE });
      setItems(result.items);
      setMeta(result.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load teams",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      showError("Team name is required");
      return;
    }

    const created = await runCreate(async () => {
      const currentUser = await getCurrentUser();
      return createTeam({
        name: createForm.name.trim(),
        description: toOptionalText(createForm.description),
        createdById: currentUser.id,
      });
    }, "Failed to create team");

    if (created) {
      setCreateForm(initialForm);
      showSuccess("Team created successfully");
      setShowCreate(false);
      await loadTeams();
    }
  };

  const removeTeam = async () => {
    if (!teamIdToDelete) {
      return;
    }

    const deleted = await runDelete(
      async () => deleteTeam(teamIdToDelete),
      "Failed to delete team",
    );

    if (deleted) {
      showSuccess("Team deleted successfully");
      setTeamIdToDelete(null);
      await loadTeams();
    }
  };

  return (
    <section className="placeholder-page">
      <h1>Team Management</h1>

      <p className="status-note">
        {meta?.total !== undefined ? `Total teams: ${meta.total}` : null}
      </p>

      <div className="page-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => setShowCreate((prev) => !prev)}
        >
          {showCreate ? "Back to list" : "Create New Team +"}
        </button>
      </div>

      {loading ? <p className="status-note">Loading teams...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      {showCreate ? (
        <CrudFormCard
          title="Create Team"
          submitLabel="Create team"
          submittingLabel="Creating..."
          submitting={creating}
          onSubmit={() => void handleCreate()}
        >
          <input
            placeholder="Team name"
            value={createForm.name}
            disabled={creating}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <input
            placeholder="Description (optional)"
            value={createForm.description}
            disabled={creating}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
        </CrudFormCard>
      ) : null}

      {!showCreate ? (
        <div className="data-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((team) => (
                <tr key={team.id}>
                  <td>
                    <Link
                      className="campaign-name-link"
                      to={`/admin/teams/${team.id}`}
                    >
                      {team.name}
                    </Link>
                  </td>
                  <td>{team.description ?? "-"}</td>
                  <td>{new Date(team.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      disabled={deleting}
                      onClick={() => setTeamIdToDelete(team.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!showCreate ? (
        <PaginationControls
          page={page}
          limit={PAGE_SIZE}
          total={meta?.total}
          currentCount={items.length}
          loading={loading}
          onPageChange={setPage}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(teamIdToDelete)}
        title="Delete team"
        message="This action removes the team and cannot be undone."
        confirmLabel="Delete"
        confirmLoading={deleting}
        onCancel={() => setTeamIdToDelete(null)}
        onConfirm={() => void removeTeam()}
      />
    </section>
  );
}

function toOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
