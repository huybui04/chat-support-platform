import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  addTeamMember,
  assignCampaignTeam,
  getAgents,
  getCampaignTeams,
  getCampaigns,
  getTeamById,
  getTeamMembers,
  removeCampaignTeam,
  removeTeamMember,
  type Campaign,
  type Team,
  type TeamMember,
  type User,
} from "../../services/admin-api";
import { useToast } from "../../store/toast-context";

const PAGE_SIZE = 50;

export function AdminTeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { showError, showSuccess } = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [assignedCampaigns, setAssignedCampaigns] = useState<Campaign[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<TeamMember[]>([]);
  const [agentOptions, setAgentOptions] = useState<User[]>([]);

  const [campaignKeyword, setCampaignKeyword] = useState("");
  const [userKeyword, setUserKeyword] = useState("");

  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [assigningCampaign, setAssigningCampaign] = useState(false);
  const [assigningUser, setAssigningUser] = useState(false);
  const [removingCampaignId, setRemovingCampaignId] = useState("");
  const [removingUserId, setRemovingUserId] = useState("");

  const loadAllCampaigns = useCallback(async () => {
    const merged: Campaign[] = [];
    let page = 1;
    let total = Number.MAX_SAFE_INTEGER;

    while (merged.length < total) {
      const result = await getCampaigns({ page, limit: PAGE_SIZE });
      if (result.items.length === 0) {
        break;
      }

      merged.push(...result.items);
      total = result.meta?.total ?? merged.length;
      page += 1;
    }

    return Array.from(new Map(merged.map((item) => [item.id, item])).values());
  }, []);

  const loadDetail = useCallback(async () => {
    if (!teamId) {
      return;
    }

    setLoading(true);
    try {
      const [teamDetail, campaigns, usersPage] = await Promise.all([
        getTeamById(teamId),
        loadAllCampaigns(),
        getAgents({ page: 1, limit: 200 }),
      ]);

      const assignedCampaignChecks = await Promise.all(
        campaigns.map(async (campaign) => {
          const links = await getCampaignTeams(campaign.id);
          const linked = links.some((link) => link.teamId === teamId);
          return linked ? campaign : null;
        }),
      );

      const teamMembers = await getTeamMembers(teamId);

      setTeam(teamDetail);
      setAllCampaigns(campaigns);
      setAssignedCampaigns(
        assignedCampaignChecks.filter(
          (item): item is Campaign => item !== null,
        ),
      );
      setAssignedUsers(teamMembers);
      setAgentOptions(usersPage.items);
      setSelectedCampaignId((prev) => prev || campaigns[0]?.id || "");
      setSelectedUserId((prev) => prev || usersPage.items[0]?.id || "");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to load team detail",
      );
    } finally {
      setLoading(false);
    }
  }, [loadAllCampaigns, showError, teamId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const availableCampaigns = useMemo(
    () =>
      allCampaigns.filter(
        (campaign) =>
          !assignedCampaigns.some((assigned) => assigned.id === campaign.id),
      ),
    [allCampaigns, assignedCampaigns],
  );

  const availableUsers = useMemo(
    () =>
      agentOptions.filter(
        (agent) => !assignedUsers.some((member) => member.userId === agent.id),
      ),
    [agentOptions, assignedUsers],
  );

  const filteredCampaigns = useMemo(() => {
    const normalized = campaignKeyword.trim().toLowerCase();
    if (!normalized) {
      return assignedCampaigns;
    }

    return assignedCampaigns.filter((campaign) =>
      campaign.name.toLowerCase().includes(normalized),
    );
  }, [assignedCampaigns, campaignKeyword]);

  const filteredUsers = useMemo(() => {
    const normalized = userKeyword.trim().toLowerCase();
    if (!normalized) {
      return assignedUsers;
    }

    return assignedUsers.filter((member) =>
      (member.user?.fullName ?? "").toLowerCase().includes(normalized),
    );
  }, [assignedUsers, userKeyword]);

  const handleAssignCampaign = async () => {
    if (!teamId || !selectedCampaignId) {
      return;
    }

    setAssigningCampaign(true);
    try {
      await assignCampaignTeam(selectedCampaignId, teamId);
      showSuccess("Campaign assigned successfully");
      await loadDetail();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to assign campaign",
      );
    } finally {
      setAssigningCampaign(false);
    }
  };

  const handleRemoveCampaign = async (campaignId: string) => {
    if (!teamId) {
      return;
    }

    setRemovingCampaignId(campaignId);
    try {
      await removeCampaignTeam(campaignId, teamId);
      showSuccess("Campaign removed successfully");
      await loadDetail();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove campaign",
      );
    } finally {
      setRemovingCampaignId("");
    }
  };

  const handleAssignUser = async () => {
    if (!teamId || !selectedUserId) {
      return;
    }

    setAssigningUser(true);
    try {
      await addTeamMember(teamId, selectedUserId);
      showSuccess("User assigned successfully");
      await loadDetail();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to assign user",
      );
    } finally {
      setAssigningUser(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!teamId) {
      return;
    }

    setRemovingUserId(userId);
    try {
      await removeTeamMember(teamId, userId);
      showSuccess("User removed successfully");
      await loadDetail();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove user",
      );
    } finally {
      setRemovingUserId("");
    }
  };

  if (!teamId) {
    return (
      <section className="placeholder-page">
        <p className="error-note">Missing team id.</p>
      </section>
    );
  }

  return (
    <section className="placeholder-page team-detail-page">
      <p className="campaign-breadcrumb">
        <Link to="/admin/agents">Agents & Team</Link> {">"}{" "}
        {team?.name ?? "Team"}
      </p>

      {loading ? <p className="status-note">Loading team detail...</p> : null}

      <div className="agent-detail-layout">
        <div className="agent-detail-assignment-col">
          <div className="agent-detail-profile-card">
            <header>
              <h2>Team Profile</h2>
            </header>
            <div className="agent-detail-grid">
              <label>
                Team Name*
                <input value={team?.name ?? ""} disabled />
              </label>
            </div>
          </div>

          <div className="data-panel">
            <div className="campaign-detail-toolbar">
              <h3>Campaign Assigned</h3>
              <div className="campaign-detail-toolbar-actions">
                <select
                  value={selectedCampaignId}
                  disabled={
                    assigningCampaign || availableCampaigns.length === 0
                  }
                  onChange={(event) =>
                    setSelectedCampaignId(event.target.value)
                  }
                >
                  {availableCampaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleAssignCampaign()}
                  disabled={
                    assigningCampaign || availableCampaigns.length === 0
                  }
                >
                  {assigningCampaign ? "..." : "+"}
                </button>
              </div>
            </div>

            <div className="campaign-detail-toolbar agent-detail-sub-toolbar">
              <input
                className="campaign-detail-inline-input"
                placeholder="Search"
                value={campaignKeyword}
                onChange={(event) => setCampaignKeyword(event.target.value)}
              />
            </div>

            <table className="data-table">
              <tbody>
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>{campaign.name}</td>
                    <td>
                      <span className="status-badge connected">Active</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={removingCampaignId === campaign.id}
                        onClick={() => void handleRemoveCampaign(campaign.id)}
                      >
                        {removingCampaignId === campaign.id
                          ? "Removing..."
                          : "..."}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <p className="status-note">No campaigns assigned.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="data-panel">
          <div className="campaign-detail-toolbar">
            <h3>Users Assigned</h3>
            <div className="campaign-detail-toolbar-actions">
              <select
                value={selectedUserId}
                disabled={assigningUser || availableUsers.length === 0}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {availableUsers.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.fullName} ({agent.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleAssignUser()}
                disabled={assigningUser || availableUsers.length === 0}
              >
                {assigningUser ? "..." : "+"}
              </button>
            </div>
          </div>

          <div className="campaign-detail-toolbar agent-detail-sub-toolbar">
            <input
              className="campaign-detail-inline-input"
              placeholder="Search"
              value={userKeyword}
              onChange={(event) => setUserKeyword(event.target.value)}
            />
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((member) => (
                <tr key={member.id}>
                  <td>{member.user?.fullName ?? member.userId}</td>
                  <td>{member.user?.email ?? "-"}</td>
                  <td>{member.user?.role ?? "agent"}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      disabled={removingUserId === member.userId}
                      onClick={() => void handleRemoveUser(member.userId)}
                    >
                      {removingUserId === member.userId ? "Removing..." : "..."}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="status-note">No users assigned.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
