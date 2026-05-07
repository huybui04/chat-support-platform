import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import {
  createAgent,
  createTeam,
  deleteAgent,
  deleteTeam,
  getAgents,
  getCurrentUser,
  getTeams,
  type Team,
  type User,
} from "../../services/admin-api";
import { useAuth } from "../../store/auth-context";
import { useAdminPresence } from "../../store/use-admin-presence";
import { useToast } from "../../store/toast-context";
import { useCrudActions } from "../../store/use-crud-actions";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

type Mode = "agents" | "teams";

type AgentForm = {
  keycloakId: string;
  fullName: string;
  email: string;
  isActive: boolean;
};

type TeamForm = {
  name: string;
  description: string;
};

const initialCreateAgentForm: AgentForm = {
  keycloakId: "",
  fullName: "",
  email: "",
  isActive: true,
};

const initialTeamForm: TeamForm = {
  name: "",
  description: "",
};

export function AdminAgentsPage() {
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();
  const { agentStatuses } = useAdminPresence(token);

  const [mode, setMode] = useState<Mode>("agents");
  const [keyword, setKeyword] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const [agentItems, setAgentItems] = useState<User[]>([]);
  const [teamItems, setTeamItems] = useState<Team[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [teamsTotal, setTeamsTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createAgentForm, setCreateAgentForm] = useState<AgentForm>(
    initialCreateAgentForm,
  );
  const [createTeamForm, setCreateTeamForm] =
    useState<TeamForm>(initialTeamForm);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: Mode;
    id: string;
  } | null>(null);

  const { creating, deleting, runCreate, runDelete } = useCrudActions();

  const effectiveAgents = useMemo(
    () =>
      agentItems.map((item) => ({
        ...item,
        isOnline: agentStatuses[item.id] ?? item.isOnline,
      })),
    [agentItems, agentStatuses],
  );

  const filteredAgents = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return effectiveAgents;
    }

    return effectiveAgents.filter(
      (agent) =>
        agent.fullName.toLowerCase().includes(normalized) ||
        agent.email.toLowerCase().includes(normalized),
    );
  }, [effectiveAgents, keyword]);

  const filteredTeams = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return teamItems;
    }

    return teamItems.filter(
      (team) =>
        team.name.toLowerCase().includes(normalized) ||
        (team.description ?? "").toLowerCase().includes(normalized),
    );
  }, [keyword, teamItems]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [agentCountResult, teamCountResult] = await Promise.all([
        getAgents({ page: 1, limit: 1 }),
        getTeams({ page: 1, limit: 1 }),
      ]);

      setAgentsTotal(
        agentCountResult.meta?.total ?? agentCountResult.items.length,
      );
      setTeamsTotal(
        teamCountResult.meta?.total ?? teamCountResult.items.length,
      );

      if (mode === "agents") {
        const result = await getAgents({ page, limit: PAGE_SIZE });
        setAgentItems(result.items);
        setMeta(result.meta);
      } else {
        const result = await getTeams({ page, limit: PAGE_SIZE });
        setTeamItems(result.items);
        setMeta(result.meta);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Failed to load ${mode}`,
      );
    } finally {
      setLoading(false);
    }
  }, [mode, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateAgent = async () => {
    if (!createAgentForm.fullName.trim() || !createAgentForm.email.trim()) {
      showError("Full name and email are required");
      return;
    }

    if (!createAgentForm.keycloakId.trim()) {
      showError("Keycloak ID is required");
      return;
    }

    const created = await runCreate(
      async () =>
        createAgent({
          keycloakId: createAgentForm.keycloakId.trim(),
          fullName: createAgentForm.fullName.trim(),
          email: createAgentForm.email.trim(),
          isActive: createAgentForm.isActive,
        }),
      "Failed to create agent",
    );

    if (created) {
      setCreateAgentForm(initialCreateAgentForm);
      showSuccess("Agent created successfully");
      setShowCreate(false);
      await loadData();
    }
  };

  const handleCreateTeam = async () => {
    if (!createTeamForm.name.trim()) {
      showError("Team name is required");
      return;
    }

    const created = await runCreate(async () => {
      const currentUser = await getCurrentUser();
      return createTeam({
        name: createTeamForm.name.trim(),
        description: toOptionalText(createTeamForm.description),
        createdById: currentUser.id,
      });
    }, "Failed to create team");

    if (created) {
      setCreateTeamForm(initialTeamForm);
      showSuccess("Team created successfully");
      setShowCreate(false);
      await loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    const deleted = await runDelete(
      async () => {
        if (deleteTarget.type === "agents") {
          await deleteAgent(deleteTarget.id);
          return;
        }

        await deleteTeam(deleteTarget.id);
      },
      deleteTarget.type === "agents"
        ? "Failed to remove agent"
        : "Failed to remove team",
    );

    if (deleted !== undefined) {
      showSuccess(
        deleteTarget.type === "agents"
          ? "Agent disabled successfully"
          : "Team deleted successfully",
      );
      setDeleteTarget(null);
      await loadData();
    }
  };

  return (
    <section className="placeholder-page agents-team-page">
      <p className="campaign-breadcrumb">
        Agents & Team {">"} {mode === "agents" ? "All Agents" : "All Team"}
      </p>

      <div className="agents-team-topbar">
        <div className="campaign-type-cards">
          <button
            type="button"
            className={`campaign-type-card ${mode === "agents" ? "active" : ""}`}
            onClick={() => {
              setMode("agents");
              setShowCreate(false);
              setPage(1);
            }}
          >
            <span>All Agents</span>
            <strong>{agentsTotal}</strong>
          </button>

          <button
            type="button"
            className={`campaign-type-card ${mode === "teams" ? "active" : ""}`}
            onClick={() => {
              setMode("teams");
              setShowCreate(false);
              setPage(1);
            }}
          >
            <span>All Team</span>
            <strong>{teamsTotal}</strong>
          </button>
        </div>

        <div className="campaign-list-toolbar">
          <input
            placeholder={
              mode === "agents" ? "Search Agents..." : "Search Teams..."
            }
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <button type="button" onClick={() => setShowCreate((prev) => !prev)}>
            {mode === "agents" ? "Create New Agent +" : "Create New Team +"}
          </button>
        </div>
      </div>

      {loading ? <p className="status-note">Loading {mode}...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      {showCreate && mode === "agents" ? (
        <CrudFormCard
          title="Create Agent"
          submitLabel="Create agent"
          submittingLabel="Creating..."
          submitting={creating}
          onSubmit={() => void handleCreateAgent()}
        >
          <input
            placeholder="Keycloak ID"
            value={createAgentForm.keycloakId}
            disabled={creating}
            onChange={(event) =>
              setCreateAgentForm((prev) => ({
                ...prev,
                keycloakId: event.target.value,
              }))
            }
          />
          <input
            placeholder="Full name"
            value={createAgentForm.fullName}
            disabled={creating}
            onChange={(event) =>
              setCreateAgentForm((prev) => ({
                ...prev,
                fullName: event.target.value,
              }))
            }
          />
          <input
            placeholder="Email"
            type="email"
            value={createAgentForm.email}
            disabled={creating}
            onChange={(event) =>
              setCreateAgentForm((prev) => ({
                ...prev,
                email: event.target.value,
              }))
            }
          />
          <label className="slide-toggle-field">
            <span>Active</span>
            <button
              type="button"
              role="switch"
              aria-checked={createAgentForm.isActive}
              aria-label="Toggle active status"
              className={`slide-toggle ${createAgentForm.isActive ? "is-on" : "is-off"}`}
              disabled={creating}
              onClick={() =>
                setCreateAgentForm((prev) => ({
                  ...prev,
                  isActive: !prev.isActive,
                }))
              }
            >
              <span className="slide-toggle-knob" />
            </button>
          </label>
        </CrudFormCard>
      ) : null}

      {showCreate && mode === "teams" ? (
        <CrudFormCard
          title="Create Team"
          submitLabel="Create team"
          submittingLabel="Creating..."
          submitting={creating}
          onSubmit={() => void handleCreateTeam()}
        >
          <input
            placeholder="Team name"
            value={createTeamForm.name}
            disabled={creating}
            onChange={(event) =>
              setCreateTeamForm((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
          />
          <input
            placeholder="Description (optional)"
            value={createTeamForm.description}
            disabled={creating}
            onChange={(event) =>
              setCreateTeamForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
        </CrudFormCard>
      ) : null}

      {mode === "agents" ? (
        <div className="data-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="status-note">No agents found.</p>
                  </td>
                </tr>
              ) : null}

              {filteredAgents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <Link
                      className="campaign-name-link"
                      to={`/admin/agents/${agent.id}`}
                    >
                      {agent.fullName}
                    </Link>
                  </td>
                  <td>{agent.email}</td>
                  <td>{agent.role}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        agent.isOnline ? "online" : "offline"
                      }`}
                    >
                      {agent.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      disabled={deleting}
                      onClick={() =>
                        setDeleteTarget({ type: "agents", id: agent.id })
                      }
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

      {mode === "teams" ? (
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
              {!loading && filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="status-note">No teams found.</p>
                  </td>
                </tr>
              ) : null}

              {filteredTeams.map((team) => (
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
                      onClick={() =>
                        setDeleteTarget({ type: "teams", id: team.id })
                      }
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

      <PaginationControls
        page={page}
        limit={PAGE_SIZE}
        total={meta?.total}
        currentCount={
          mode === "agents" ? filteredAgents.length : filteredTeams.length
        }
        loading={loading}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.type === "agents" ? "Disable agent" : "Delete team"
        }
        message={
          deleteTarget?.type === "agents"
            ? "This action will deactivate the selected agent account."
            : "This action removes the selected team and cannot be undone."
        }
        confirmLabel={deleteTarget?.type === "agents" ? "Disable" : "Delete"}
        confirmLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  );
}

function toOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
