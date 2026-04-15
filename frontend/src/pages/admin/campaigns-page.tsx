import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import { RowActionButtons } from "../../components/common/row-action-buttons";
import {
  assignCampaignAgent,
  assignCampaignTeam,
  createCampaign,
  deleteCampaign,
  getAgents,
  getCampaignAgents,
  getCampaigns,
  getCampaignTeams,
  getCurrentUser,
  getTeams,
  removeCampaignAgent,
  removeCampaignTeam,
  type CampaignAgentAssignment,
  type CampaignTeamAssignment,
  type Team,
  type User,
  updateCampaign,
  type Campaign,
} from "../../services/admin-api";
import { useToast } from "../../store/toast-context";
import { useCrudActions } from "../../store/use-crud-actions";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

type CampaignForm = {
  name: string;
  description: string;
  status: Campaign["status"];
  channel: Campaign["channel"];
  startDate: string;
  endDate: string;
};

type CampaignManagementTab = "list" | "create" | "assign-agent" | "assign-team";

const initialForm: CampaignForm = {
  name: "",
  description: "",
  status: "draft",
  channel: "web",
  startDate: "",
  endDate: "",
};

export function AdminCampaignsPage() {
  const { showError, showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<CampaignManagementTab>("list");
  const [items, setItems] = useState<Campaign[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState<CampaignForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CampaignForm>(initialForm);
  const [campaignIdToDelete, setCampaignIdToDelete] = useState<string | null>(
    null,
  );
  const [assignCampaignId, setAssignCampaignId] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  const [agents, setAgents] = useState<User[]>([]);
  const [assignedAgents, setAssignedAgents] = useState<
    CampaignAgentAssignment[]
  >([]);
  const [assignedAgentsLoading, setAssignedAgentsLoading] = useState(false);
  const [removingAgentId, setRemovingAgentId] = useState("");
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [assignTeamCampaignId, setAssignTeamCampaignId] = useState("");
  const [assignTeamId, setAssignTeamId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignedTeams, setAssignedTeams] = useState<CampaignTeamAssignment[]>(
    [],
  );
  const [assignedTeamsLoading, setAssignedTeamsLoading] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState("");
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [assigningTeam, setAssigningTeam] = useState(false);
  const { creating, savingId, deleting, runCreate, runSave, runDelete } =
    useCrudActions();

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCampaigns({ page, limit: PAGE_SIZE });
      setItems(result.items);
      setMeta(result.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load campaigns",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!assignCampaignId && items.length > 0) {
      setAssignCampaignId(items[0].id);
    }
  }, [assignCampaignId, items]);

  useEffect(() => {
    if (!assignTeamCampaignId && items.length > 0) {
      setAssignTeamCampaignId(items[0].id);
    }
  }, [assignTeamCampaignId, items]);

  useEffect(() => {
    let cancelled = false;

    const loadAgents = async () => {
      setAgentsLoading(true);
      try {
        const result = await getAgents({ page: 1, limit: 100 });
        if (!cancelled) {
          setAgents(result.items);
          if (!assignAgentId && result.items.length > 0) {
            setAssignAgentId(result.items[0].id);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          showError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load agents",
          );
        }
      } finally {
        if (!cancelled) {
          setAgentsLoading(false);
        }
      }
    };

    void loadAgents();

    return () => {
      cancelled = true;
    };
  }, [assignAgentId, showError]);

  useEffect(() => {
    let cancelled = false;

    const loadTeams = async () => {
      setTeamsLoading(true);
      try {
        const result = await getTeams({ page: 1, limit: 100 });
        if (!cancelled) {
          setTeams(result.items);
          if (!assignTeamId && result.items.length > 0) {
            setAssignTeamId(result.items[0].id);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          showError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load teams",
          );
        }
      } finally {
        if (!cancelled) {
          setTeamsLoading(false);
        }
      }
    };

    void loadTeams();

    return () => {
      cancelled = true;
    };
  }, [assignTeamId, showError]);

  useEffect(() => {
    if (!assignCampaignId) {
      setAssignedAgents([]);
      return;
    }

    let cancelled = false;

    const loadAssignedAgents = async () => {
      setAssignedAgentsLoading(true);
      try {
        const result = await getCampaignAgents(assignCampaignId);
        if (!cancelled) {
          setAssignedAgents(result);
        }
      } catch (caughtError) {
        if (!cancelled) {
          showError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load assigned agents",
          );
        }
      } finally {
        if (!cancelled) {
          setAssignedAgentsLoading(false);
        }
      }
    };

    void loadAssignedAgents();

    return () => {
      cancelled = true;
    };
  }, [assignCampaignId, showError]);

  useEffect(() => {
    if (!assignTeamCampaignId) {
      setAssignedTeams([]);
      return;
    }

    let cancelled = false;

    const loadAssignedTeams = async () => {
      setAssignedTeamsLoading(true);
      try {
        const result = await getCampaignTeams(assignTeamCampaignId);
        if (!cancelled) {
          setAssignedTeams(result);
        }
      } catch (caughtError) {
        if (!cancelled) {
          showError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load assigned teams",
          );
        }
      } finally {
        if (!cancelled) {
          setAssignedTeamsLoading(false);
        }
      }
    };

    void loadAssignedTeams();

    return () => {
      cancelled = true;
    };
  }, [assignTeamCampaignId, showError]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      showError("Campaign name is required");
      return;
    }

    const created = await runCreate(async () => {
      const currentUser = await getCurrentUser();
      return createCampaign({
        name: createForm.name.trim(),
        description: toOptionalText(createForm.description),
        status: createForm.status,
        channel: createForm.channel,
        startDate: toOptionalIsoString(createForm.startDate),
        endDate: toOptionalIsoString(createForm.endDate),
        createdById: currentUser.id,
      });
    }, "Failed to create campaign");

    if (created) {
      setCreateForm(initialForm);
      showSuccess("Campaign created successfully");
      await loadCampaigns();
    }
  };

  const startEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setEditForm({
      name: campaign.name,
      description: campaign.description ?? "",
      status: campaign.status,
      channel: campaign.channel,
      startDate: toDateTimeLocal(campaign.startDate),
      endDate: toDateTimeLocal(campaign.endDate),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialForm);
  };

  const saveEdit = async (id: string) => {
    if (!editForm.name.trim()) {
      showError("Campaign name is required");
      return;
    }

    const updated = await runSave(
      id,
      async () =>
        updateCampaign(id, {
          name: editForm.name.trim(),
          description: toOptionalText(editForm.description),
          status: editForm.status,
          channel: editForm.channel,
          startDate: toOptionalIsoString(editForm.startDate),
          endDate: toOptionalIsoString(editForm.endDate),
        }),
      "Failed to update campaign",
    );

    if (updated) {
      showSuccess("Campaign updated successfully");
      cancelEdit();
      await loadCampaigns();
    }
  };

  const removeCampaign = async () => {
    if (!campaignIdToDelete) {
      return;
    }

    const deleted = await runDelete(
      async () => deleteCampaign(campaignIdToDelete),
      "Failed to delete campaign",
    );

    if (deleted !== undefined) {
      showSuccess("Campaign deleted successfully");
      setCampaignIdToDelete(null);
      await loadCampaigns();
    }
  };

  const assignAgentToCampaign = async () => {
    if (!assignCampaignId) {
      showError("Please select a campaign");
      return;
    }

    if (!assignAgentId) {
      showError("Please select an agent");
      return;
    }

    setAssigningAgent(true);
    try {
      await assignCampaignAgent(assignCampaignId, assignAgentId);
      const updated = await getCampaignAgents(assignCampaignId);
      setAssignedAgents(updated);
      showSuccess("Agent assigned to campaign successfully");
    } catch (caughtError) {
      showError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to assign agent to campaign",
      );
    } finally {
      setAssigningAgent(false);
    }
  };

  const assignTeamToCampaign = async () => {
    if (!assignTeamCampaignId) {
      showError("Please select a campaign");
      return;
    }

    if (!assignTeamId) {
      showError("Please select a team");
      return;
    }

    setAssigningTeam(true);
    try {
      await assignCampaignTeam(assignTeamCampaignId, assignTeamId);
      const updated = await getCampaignTeams(assignTeamCampaignId);
      setAssignedTeams(updated);
      showSuccess("Team assigned to campaign successfully");
    } catch (caughtError) {
      showError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to assign team to campaign",
      );
    } finally {
      setAssigningTeam(false);
    }
  };

  const unassignAgent = async (campaignId: string, agentId: string) => {
    setRemovingAgentId(agentId);
    try {
      await removeCampaignAgent(campaignId, agentId);
      const updated = await getCampaignAgents(campaignId);
      setAssignedAgents(updated);
      showSuccess("Agent removed from campaign");
    } catch (caughtError) {
      showError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to remove agent from campaign",
      );
    } finally {
      setRemovingAgentId("");
    }
  };

  const unassignTeam = async (campaignId: string, teamId: string) => {
    setRemovingTeamId(teamId);
    try {
      await removeCampaignTeam(campaignId, teamId);
      const updated = await getCampaignTeams(campaignId);
      setAssignedTeams(updated);
      showSuccess("Team removed from campaign");
    } catch (caughtError) {
      showError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to remove team from campaign",
      );
    } finally {
      setRemovingTeamId("");
    }
  };

  return (
    <section className="placeholder-page">
      <h1>Campaign Management</h1>
      <p className="status-note">
        Manage campaigns by workflow: list, create, assign agents, and assign
        teams.
      </p>

      <p className="status-note">
        {meta?.total !== undefined ? `Total campaigns: ${meta.total}` : null}
      </p>
      {loading ? <p className="status-note">Loading campaigns...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div
        className="management-tabs"
        role="tablist"
        aria-label="Campaign management sections"
      >
        <button
          type="button"
          className={`management-tab ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          Campaign List
        </button>
        <button
          type="button"
          className={`management-tab ${activeTab === "create" ? "active" : ""}`}
          onClick={() => setActiveTab("create")}
        >
          Create Campaign
        </button>
        <button
          type="button"
          className={`management-tab ${activeTab === "assign-agent" ? "active" : ""}`}
          onClick={() => setActiveTab("assign-agent")}
        >
          Assign Agents
        </button>
        <button
          type="button"
          className={`management-tab ${activeTab === "assign-team" ? "active" : ""}`}
          onClick={() => setActiveTab("assign-team")}
        >
          Assign Teams
        </button>
      </div>

      {activeTab === "create" ? (
        <CrudFormCard
          title="Create Campaign"
          submitLabel="Create campaign"
          submittingLabel="Creating..."
          submitting={creating}
          onSubmit={() => void handleCreate()}
        >
          <input
            placeholder="Campaign name"
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
          <select
            value={createForm.status}
            disabled={creating}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                status: event.target.value as Campaign["status"],
              }))
            }
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
          </select>
          <select
            value={createForm.channel}
            disabled={creating}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                channel: event.target.value as Campaign["channel"],
              }))
            }
          >
            <option value="web">web</option>
            <option value="whatsapp">whatsapp</option>
          </select>
          <input
            type="datetime-local"
            value={createForm.startDate}
            disabled={creating}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                startDate: event.target.value,
              }))
            }
          />
          <input
            type="datetime-local"
            value={createForm.endDate}
            disabled={creating}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                endDate: event.target.value,
              }))
            }
          />
        </CrudFormCard>
      ) : null}

      {activeTab === "assign-agent" ? (
        <div className="crud-form">
          <h2>Assign Agent To Campaign</h2>
          <div className="crud-form-grid">
            <select
              value={assignCampaignId}
              disabled={assigningAgent || items.length === 0}
              onChange={(event) => setAssignCampaignId(event.target.value)}
            >
              {items.length === 0 ? (
                <option value="">No campaign available on this page</option>
              ) : null}
              {items.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>

            <select
              value={assignAgentId}
              disabled={assigningAgent || agentsLoading || agents.length === 0}
              onChange={(event) => setAssignAgentId(event.target.value)}
            >
              {agents.length === 0 ? (
                <option value="">No agent available</option>
              ) : null}
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.fullName} ({agent.email})
                </option>
              ))}
            </select>
          </div>
          <div className="page-actions">
            <button
              type="button"
              onClick={() => void assignAgentToCampaign()}
              disabled={
                assigningAgent ||
                items.length === 0 ||
                agents.length === 0 ||
                agentsLoading
              }
            >
              {assigningAgent ? "Assigning..." : "Assign Agent"}
            </button>
          </div>
          <div className="data-panel">
            <h2>Assigned Agents</h2>
            {assignedAgentsLoading ? (
              <p className="status-note">Loading assigned agents...</p>
            ) : null}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Email</th>
                  <th>Assigned At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!assignedAgentsLoading && assignedAgents.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <p className="status-note">No agents assigned.</p>
                    </td>
                  </tr>
                ) : null}
                {assignedAgents.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.agent?.fullName ?? assignment.agentId}</td>
                    <td>{assignment.agent?.email ?? "-"}</td>
                    <td>{new Date(assignment.assignedAt).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={removingAgentId === assignment.agentId}
                        onClick={() =>
                          void unassignAgent(
                            assignment.campaignId,
                            assignment.agentId,
                          )
                        }
                      >
                        {removingAgentId === assignment.agentId
                          ? "Removing..."
                          : "Unassign"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "assign-team" ? (
        <div className="crud-form">
          <h2>Assign Team To Campaign</h2>
          <div className="crud-form-grid">
            <select
              value={assignTeamCampaignId}
              disabled={assigningTeam || items.length === 0}
              onChange={(event) => setAssignTeamCampaignId(event.target.value)}
            >
              {items.length === 0 ? (
                <option value="">No campaign available on this page</option>
              ) : null}
              {items.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>

            <select
              value={assignTeamId}
              disabled={assigningTeam || teamsLoading || teams.length === 0}
              onChange={(event) => setAssignTeamId(event.target.value)}
            >
              {teams.length === 0 ? (
                <option value="">No team available</option>
              ) : null}
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="page-actions">
            <button
              type="button"
              onClick={() => void assignTeamToCampaign()}
              disabled={
                assigningTeam ||
                items.length === 0 ||
                teams.length === 0 ||
                teamsLoading
              }
            >
              {assigningTeam ? "Assigning..." : "Assign Team"}
            </button>
          </div>
          <div className="data-panel">
            <h2>Assigned Teams</h2>
            {assignedTeamsLoading ? (
              <p className="status-note">Loading assigned teams...</p>
            ) : null}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!assignedTeamsLoading && assignedTeams.length === 0 ? (
                  <tr>
                    <td colSpan={2}>
                      <p className="status-note">No teams assigned.</p>
                    </td>
                  </tr>
                ) : null}
                {assignedTeams.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.team?.name ?? assignment.teamId}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={removingTeamId === assignment.teamId}
                        onClick={() =>
                          void unassignTeam(
                            assignment.campaignId,
                            assignment.teamId,
                          )
                        }
                      >
                        {removingTeamId === assignment.teamId
                          ? "Removing..."
                          : "Unassign"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "list" ? (
        <div className="data-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Channel</th>
                <th>Start</th>
                <th>End</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    {editingId === campaign.id ? (
                      <input
                        value={editForm.name}
                        disabled={savingId === campaign.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      campaign.name
                    )}
                  </td>
                  <td>
                    {editingId === campaign.id ? (
                      <input
                        value={editForm.description}
                        disabled={savingId === campaign.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      (campaign.description ?? "-")
                    )}
                  </td>
                  <td>
                    {editingId === campaign.id ? (
                      <select
                        value={editForm.status}
                        disabled={savingId === campaign.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            status: event.target.value as Campaign["status"],
                          }))
                        }
                      >
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="completed">completed</option>
                      </select>
                    ) : (
                      campaign.status
                    )}
                  </td>
                  <td>
                    {editingId === campaign.id ? (
                      <select
                        value={editForm.channel}
                        disabled={savingId === campaign.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            channel: event.target.value as Campaign["channel"],
                          }))
                        }
                      >
                        <option value="web">web</option>
                        <option value="whatsapp">whatsapp</option>
                      </select>
                    ) : (
                      campaign.channel
                    )}
                  </td>
                  <td>
                    {editingId === campaign.id ? (
                      <input
                        type="datetime-local"
                        value={editForm.startDate}
                        disabled={savingId === campaign.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            startDate: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      (campaign.startDate ?? "-")
                    )}
                  </td>
                  <td>
                    {editingId === campaign.id ? (
                      <input
                        type="datetime-local"
                        value={editForm.endDate}
                        disabled={savingId === campaign.id}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            endDate: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      (campaign.endDate ?? "-")
                    )}
                  </td>
                  <td>
                    <RowActionButtons
                      editing={editingId === campaign.id}
                      saving={savingId === campaign.id}
                      deletingDisabled={deleting}
                      onSave={() => void saveEdit(campaign.id)}
                      onCancel={cancelEdit}
                      onEdit={() => startEdit(campaign)}
                      onDelete={() => setCampaignIdToDelete(campaign.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "list" ? (
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
        open={Boolean(campaignIdToDelete)}
        title="Delete campaign"
        message="This action will permanently remove the campaign."
        confirmLabel="Delete"
        confirmLoading={deleting}
        onCancel={() => setCampaignIdToDelete(null)}
        onConfirm={() => void removeCampaign()}
      />
    </section>
  );
}

function toOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toOptionalIsoString(value: string) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}
