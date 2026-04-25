import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  assignCampaignAgent,
  getCampaignAgents,
  getCampaigns,
  getTeamMembers,
  getTeams,
  getUserById,
  removeCampaignAgent,
  removeTeamMember,
  type Campaign,
  type Team,
  type User,
} from "../../services/admin-api";
import { useToast } from "../../store/toast-context";

const CAMPAIGNS_PAGE_SIZE = 50;
const TEAMS_PAGE_SIZE = 50;

export function AdminAgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { showError, showSuccess } = useToast();

  const [agent, setAgent] = useState<User | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [assignedCampaigns, setAssignedCampaigns] = useState<Campaign[]>([]);
  const [assignedTeams, setAssignedTeams] = useState<Team[]>([]);

  const [searchCampaign, setSearchCampaign] = useState("");
  const [searchTeam, setSearchTeam] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const [loading, setLoading] = useState(true);
  const [assigningCampaign, setAssigningCampaign] = useState(false);
  const [removingCampaignId, setRemovingCampaignId] = useState("");
  const [removingTeamId, setRemovingTeamId] = useState("");

  const loadDetail = useCallback(async () => {
    if (!agentId) {
      return;
    }

    setLoading(true);
    try {
      const user = await getUserById(agentId);

      const campaigns: Campaign[] = [];
      let currentPage = 1;
      let total = Number.MAX_SAFE_INTEGER;

      while (campaigns.length < total) {
        const result = await getCampaigns({
          page: currentPage,
          limit: CAMPAIGNS_PAGE_SIZE,
        });

        if (result.items.length === 0) {
          break;
        }

        campaigns.push(...result.items);
        total = result.meta?.total ?? campaigns.length;
        currentPage += 1;
      }

      const dedupedCampaigns = Array.from(
        new Map(campaigns.map((campaign) => [campaign.id, campaign])).values(),
      );

      const assignmentChecks = await Promise.all(
        dedupedCampaigns.map(async (campaign) => {
          const assignments = await getCampaignAgents(campaign.id);
          const linked = assignments.some((item) => item.agentId === agentId);

          return linked ? campaign : null;
        }),
      );

      const linkedCampaigns = assignmentChecks.filter(
        (campaign): campaign is Campaign => campaign !== null,
      );

      const teams: Team[] = [];
      let teamPage = 1;
      let teamTotal = Number.MAX_SAFE_INTEGER;

      while (teams.length < teamTotal) {
        const result = await getTeams({
          page: teamPage,
          limit: TEAMS_PAGE_SIZE,
        });
        if (result.items.length === 0) {
          break;
        }

        teams.push(...result.items);
        teamTotal = result.meta?.total ?? teams.length;
        teamPage += 1;
      }

      const assignedTeamChecks = await Promise.all(
        teams.map(async (team) => {
          const members = await getTeamMembers(team.id);
          const linked = members.some((member) => member.userId === agentId);

          return linked ? team : null;
        }),
      );

      setAgent(user);
      setAllCampaigns(dedupedCampaigns);
      setAssignedCampaigns(linkedCampaigns);
      setAssignedTeams(
        assignedTeamChecks.filter((team): team is Team => team !== null),
      );
      setSelectedCampaignId((prev) => prev || dedupedCampaigns[0]?.id || "");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to load agent detail",
      );
    } finally {
      setLoading(false);
    }
  }, [agentId, showError]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const filteredCampaigns = useMemo(() => {
    const normalized = searchCampaign.trim().toLowerCase();
    if (!normalized) {
      return assignedCampaigns;
    }

    return assignedCampaigns.filter((campaign) =>
      campaign.name.toLowerCase().includes(normalized),
    );
  }, [assignedCampaigns, searchCampaign]);

  const filteredTeams = useMemo(() => {
    const normalized = searchTeam.trim().toLowerCase();
    if (!normalized) {
      return assignedTeams;
    }

    return assignedTeams.filter((team) =>
      team.name.toLowerCase().includes(normalized),
    );
  }, [assignedTeams, searchTeam]);

  const availableCampaigns = useMemo(
    () =>
      allCampaigns.filter(
        (campaign) =>
          !assignedCampaigns.some((assigned) => assigned.id === campaign.id),
      ),
    [allCampaigns, assignedCampaigns],
  );

  const handleAssignCampaign = async () => {
    if (!agentId || !selectedCampaignId) {
      return;
    }

    setAssigningCampaign(true);
    try {
      await assignCampaignAgent(selectedCampaignId, agentId);
      showSuccess("Campaign assigned to agent");
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
    if (!agentId) {
      return;
    }

    setRemovingCampaignId(campaignId);
    try {
      await removeCampaignAgent(campaignId, agentId);
      showSuccess("Campaign removed from agent");
      await loadDetail();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove campaign",
      );
    } finally {
      setRemovingCampaignId("");
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    if (!agentId) {
      return;
    }

    setRemovingTeamId(teamId);
    try {
      await removeTeamMember(teamId, agentId);
      showSuccess("Team removed from agent");
      await loadDetail();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove team",
      );
    } finally {
      setRemovingTeamId("");
    }
  };

  if (!agentId) {
    return (
      <section className="placeholder-page">
        <p className="error-note">Missing agent id.</p>
      </section>
    );
  }

  return (
    <section className="placeholder-page agent-detail-page">
      <p className="campaign-breadcrumb">
        <Link to="/admin/agents">Agents & Team</Link> {">"}{" "}
        {agent?.fullName ?? "Agent"}
      </p>

      {loading ? <p className="status-note">Loading agent detail...</p> : null}

      <div className="agent-detail-layout">
        <div className="agent-detail-profile-card">
          <header>
            <h2>Agent Profile</h2>
            <span
              className={`status-badge ${agent?.isOnline ? "online" : "offline"}`}
            >
              {agent?.isOnline ? "Online" : "Offline"}
            </span>
          </header>

          <div className="agent-detail-grid">
            <label>
              Agent ID
              <input value={agent?.id ?? ""} disabled />
            </label>
            <label>
              User ID
              <input value={agent?.keycloakId ?? ""} disabled />
            </label>
            <label>
              Full Name
              <input value={agent?.fullName ?? ""} disabled />
            </label>
            <label>
              Email
              <input value={agent?.email ?? ""} disabled />
            </label>
            <label>
              User Role
              <input value={agent?.role ?? ""} disabled />
            </label>
            <label>
              Active
              <input value={agent?.isActive ? "Yes" : "No"} disabled />
            </label>
          </div>
        </div>

        <div className="agent-detail-assignment-col">
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
                  disabled={
                    assigningCampaign || availableCampaigns.length === 0
                  }
                  onClick={() => void handleAssignCampaign()}
                >
                  {assigningCampaign ? "Assigning..." : "+"}
                </button>
              </div>
            </div>

            <div className="campaign-detail-toolbar agent-detail-sub-toolbar">
              <input
                className="campaign-detail-inline-input"
                placeholder="Search"
                value={searchCampaign}
                onChange={(event) => setSearchCampaign(event.target.value)}
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
                          : "Remove"}
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

          <div className="data-panel">
            <div className="campaign-detail-toolbar">
              <h3>Team Assigned</h3>
            </div>
            <div className="campaign-detail-toolbar agent-detail-sub-toolbar">
              <input
                className="campaign-detail-inline-input"
                placeholder="Search"
                value={searchTeam}
                onChange={(event) => setSearchTeam(event.target.value)}
              />
            </div>

            <table className="data-table">
              <tbody>
                {filteredTeams.map((team) => (
                  <tr key={team.id}>
                    <td>{team.name}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={removingTeamId === team.id}
                        onClick={() => void handleRemoveTeam(team.id)}
                      >
                        {removingTeamId === team.id ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={2}>
                      <p className="status-note">No teams assigned.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
