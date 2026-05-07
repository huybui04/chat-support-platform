import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  assignCampaignAgent,
  assignCampaignTeam,
  createChannelMapping,
  deleteChannelMapping,
  getAgents,
  getCampaign,
  getCampaignAgents,
  getCampaignTeams,
  getChannelMappings,
  getGmailAccounts,
  getInteractionHistory,
  getTeams,
  removeCampaignAgent,
  removeCampaignTeam,
  updateChannelMapping,
  type Campaign,
  type CampaignAgentAssignment,
  type CampaignTeamAssignment,
  type ChannelMapping,
  type ExternalChannel,
  type GmailAccountSummary,
  type InteractionSession,
  type Team,
  type User,
} from "../../services/admin-api";
import { getSessionMessages, type ChatMessage } from "../../services/agent-api";
import { useToast } from "../../store/toast-context";

type DetailTab = "users" | "teams" | "configurations" | "interactions";

export function AdminCampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { showError, showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<DetailTab>("users");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(true);

  const [agentOptions, setAgentOptions] = useState<User[]>([]);
  const [assignedAgents, setAssignedAgents] = useState<
    CampaignAgentAssignment[]
  >([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [removingAgentId, setRemovingAgentId] = useState("");

  const [teamOptions, setTeamOptions] = useState<Team[]>([]);
  const [assignedTeams, setAssignedTeams] = useState<CampaignTeamAssignment[]>(
    [],
  );
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [assigningTeam, setAssigningTeam] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState("");

  const [mappings, setMappings] = useState<ChannelMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccountSummary[]>([]);
  const [loadingGmailAccounts, setLoadingGmailAccounts] = useState(true);
  const [creatingMapping, setCreatingMapping] = useState(false);
  const [deletingMappingId, setDeletingMappingId] = useState("");
  const [togglingMappingId, setTogglingMappingId] = useState("");
  const [mappingForm, setMappingForm] = useState({
    externalAccountId: "",
    priority: 1,
    isActive: true,
  });

  const [interactionHistory, setInteractionHistory] = useState<
    InteractionSession[]
  >([]);
  const [loadingInteractionHistory, setLoadingInteractionHistory] =
    useState(true);
  const [viewingInteraction, setViewingInteraction] =
    useState<InteractionSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const inboundOrOutbound =
    campaign?.type === "inbound" ? "Inbound" : "Outbound";
  const mappingChannel = campaign?.channel ?? "web";
  const isGmailMapping = mappingChannel === "gmail";
  const isMappingSupported = mappingChannel !== "web";
  const hasGmailAccount = gmailAccounts.length > 0;

  const loadCampaign = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    setLoadingCampaign(true);
    try {
      const detail = await getCampaign(campaignId);
      setCampaign(detail);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to load campaign detail",
      );
    } finally {
      setLoadingCampaign(false);
    }
  }, [campaignId, showError]);

  const loadUsersTabData = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    setLoadingAgents(true);
    try {
      const [optionsResult, assignedResult] = await Promise.all([
        getAgents({ page: 1, limit: 100 }),
        getCampaignAgents(campaignId),
      ]);

      setAgentOptions(optionsResult.items);
      setAssignedAgents(assignedResult);

      if (!selectedAgentId && optionsResult.items.length > 0) {
        setSelectedAgentId(optionsResult.items[0].id);
      }
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to load campaign users data",
      );
    } finally {
      setLoadingAgents(false);
    }
  }, [campaignId, selectedAgentId, showError]);

  const loadTeamsTabData = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    setLoadingTeams(true);
    try {
      const [optionsResult, assignedResult] = await Promise.all([
        getTeams({ page: 1, limit: 100 }),
        getCampaignTeams(campaignId),
      ]);

      setTeamOptions(optionsResult.items);
      setAssignedTeams(assignedResult);

      if (!selectedTeamId && optionsResult.items.length > 0) {
        setSelectedTeamId(optionsResult.items[0].id);
      }
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to load campaign teams data",
      );
    } finally {
      setLoadingTeams(false);
    }
  }, [campaignId, selectedTeamId, showError]);

  const loadConfigurationsTabData = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    setLoadingMappings(true);
    try {
      const result = await getChannelMappings({
        page: 1,
        limit: 100,
        campaignId,
      });
      setMappings(result.items);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to load campaign configurations",
      );
    } finally {
      setLoadingMappings(false);
    }
  }, [campaignId, showError]);

  const loadGmailAccounts = useCallback(async () => {
    setLoadingGmailAccounts(true);
    try {
      const accounts = await getGmailAccounts();
      setGmailAccounts(accounts);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to load Gmail accounts",
      );
    } finally {
      setLoadingGmailAccounts(false);
    }
  }, [showError]);

  const loadInteractionHistoryData = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    setLoadingInteractionHistory(true);
    try {
      const result = await getInteractionHistory({
        page: 1,
        limit: 100,
        campaignId,
      });
      setInteractionHistory(result.items);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to load interaction history",
      );
    } finally {
      setLoadingInteractionHistory(false);
    }
  }, [campaignId, showError]);

  useEffect(() => {
    void loadCampaign();
    void loadUsersTabData();
    void loadTeamsTabData();
    void loadConfigurationsTabData();
    void loadGmailAccounts();
    void loadInteractionHistoryData();
  }, [
    loadCampaign,
    loadConfigurationsTabData,
    loadGmailAccounts,
    loadTeamsTabData,
    loadUsersTabData,
    loadInteractionHistoryData,
  ]);

  useEffect(() => {
    if (!viewingInteraction) {
      setChatMessages([]);
      setChatError("");
      setChatLoading(false);
      return;
    }

    let cancelled = false;

    const loadChatHistory = async () => {
      setChatLoading(true);
      setChatError("");
      try {
        const result = await getSessionMessages(viewingInteraction.id, {
          limit: 100,
        });

        if (!cancelled) {
          setChatMessages(result.items);
        }
      } catch (error) {
        if (!cancelled) {
          setChatMessages([]);
          setChatError(
            error instanceof Error
              ? error.message
              : "Failed to load chat history",
          );
        }
      } finally {
        if (!cancelled) {
          setChatLoading(false);
        }
      }
    };

    void loadChatHistory();

    return () => {
      cancelled = true;
    };
  }, [viewingInteraction]);

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";
  const gmailAuthorizeUrl = useMemo(() => {
    const returnUrl = window.location.href;
    return `${apiBaseUrl}/gmail/oauth/authorize?returnUrl=${encodeURIComponent(returnUrl)}`;
  }, [apiBaseUrl]);

  const handleAssignAgent = async () => {
    if (!campaignId || !selectedAgentId) {
      return;
    }

    setAssigningAgent(true);
    try {
      await assignCampaignAgent(campaignId, selectedAgentId);
      await loadUsersTabData();
      showSuccess("User assigned successfully");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to assign user",
      );
    } finally {
      setAssigningAgent(false);
    }
  };

  const handleRemoveAgent = async (agentId: string) => {
    if (!campaignId) {
      return;
    }

    setRemovingAgentId(agentId);
    try {
      await removeCampaignAgent(campaignId, agentId);
      await loadUsersTabData();
      showSuccess("User removed successfully");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove user",
      );
    } finally {
      setRemovingAgentId("");
    }
  };

  const handleAssignTeam = async () => {
    if (!campaignId || !selectedTeamId) {
      return;
    }

    setAssigningTeam(true);
    try {
      await assignCampaignTeam(campaignId, selectedTeamId);
      await loadTeamsTabData();
      showSuccess("Team assigned successfully");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to assign team",
      );
    } finally {
      setAssigningTeam(false);
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    if (!campaignId) {
      return;
    }

    setRemovingTeamId(teamId);
    try {
      await removeCampaignTeam(campaignId, teamId);
      await loadTeamsTabData();
      showSuccess("Team removed successfully");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove team",
      );
    } finally {
      setRemovingTeamId("");
    }
  };

  const handleCreateMapping = async () => {
    if (!campaignId || !mappingForm.externalAccountId.trim()) {
      showError("External account id is required");
      return;
    }

    if (!isMappingSupported) {
      showError("Channel mappings are not supported for web campaigns");
      return;
    }

    if (isGmailMapping && !hasGmailAccount) {
      showError("Connect Gmail before saving a Gmail mapping");
      return;
    }

    setCreatingMapping(true);
    try {
      await createChannelMapping({
        channel: mappingChannel as ExternalChannel,
        externalAccountId: mappingForm.externalAccountId.trim(),
        campaignId,
        priority: mappingForm.priority,
        isActive: mappingForm.isActive,
      });
      setMappingForm((prev) => ({
        ...prev,
        externalAccountId: "",
        priority: 1,
        isActive: true,
      }));
      await loadConfigurationsTabData();
      showSuccess("Configuration created successfully");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to create configuration",
      );
    } finally {
      setCreatingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    setDeletingMappingId(mappingId);
    try {
      await deleteChannelMapping(mappingId);
      await loadConfigurationsTabData();
      showSuccess("Configuration removed successfully");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to remove configuration",
      );
    } finally {
      setDeletingMappingId("");
    }
  };

  const handleToggleMappingActive = async (mapping: ChannelMapping) => {
    setTogglingMappingId(mapping.id);
    try {
      await updateChannelMapping(mapping.id, {
        isActive: !mapping.isActive,
      });
      await loadConfigurationsTabData();
      showSuccess(
        `Configuration ${mapping.isActive ? "deactivated" : "activated"} successfully`,
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to update configuration status",
      );
    } finally {
      setTogglingMappingId("");
    }
  };

  const channelBadgeClass = useMemo(() => {
    if (!campaign) {
      return "status-badge";
    }

    return `status-badge channel-${campaign.channel}`;
  }, [campaign]);

  if (!campaignId) {
    return (
      <section className="placeholder-page">
        <p className="error-note">Missing campaign id.</p>
      </section>
    );
  }

  return (
    <section className="placeholder-page campaign-detail-page">
      <p className="campaign-breadcrumb">
        <Link to="/admin/campaigns?tab=list">All Campaigns</Link>
        {" > "}
        {inboundOrOutbound} Campaigns
        {" > "}
        {campaign?.name ?? "Campaign"}
      </p>

      <div className="campaign-detail-layout">
        <aside className="campaign-detail-sidebar">
          <div className="campaign-detail-card">
            <h2>{campaign?.name ?? "Campaign"}</h2>
            {loadingCampaign ? <p className="status-note">Loading...</p> : null}
            <div className="campaign-detail-meta-grid">
              <div>
                <span>Status</span>
                <strong>{campaign?.status ?? "-"}</strong>
              </div>
              <div>
                <span>Service Type</span>
                <strong>{campaign?.type ?? "-"}</strong>
              </div>
              <div>
                <span>Campaign ID</span>
                <strong>{campaign?.id ?? "-"}</strong>
              </div>
              <div>
                <span>Channel Assigned</span>
                <strong>
                  {campaign ? (
                    <span className={channelBadgeClass}>
                      {campaign.channel}
                    </span>
                  ) : (
                    "-"
                  )}
                </strong>
              </div>
            </div>
          </div>
        </aside>

        <div className="campaign-detail-main">
          <div
            className="campaign-detail-tabs"
            role="tablist"
            aria-label="Campaign detail tabs"
          >
            <button
              type="button"
              className={activeTab === "users" ? "active" : ""}
              onClick={() => setActiveTab("users")}
            >
              Users
            </button>
            <button
              type="button"
              className={activeTab === "teams" ? "active" : ""}
              onClick={() => setActiveTab("teams")}
            >
              Teams
            </button>
            <button
              type="button"
              className={activeTab === "configurations" ? "active" : ""}
              onClick={() => setActiveTab("configurations")}
            >
              Configurations
            </button>
            <button
              type="button"
              className={activeTab === "interactions" ? "active" : ""}
              onClick={() => setActiveTab("interactions")}
            >
              Interaction History
            </button>
          </div>

          {activeTab === "users" ? (
            <div className="data-panel campaign-detail-tab-panel">
              <div className="campaign-detail-toolbar">
                <h3>Users Assigned</h3>
                <div className="campaign-detail-toolbar-actions">
                  <select
                    value={selectedAgentId}
                    disabled={
                      loadingAgents ||
                      assigningAgent ||
                      agentOptions.length === 0
                    }
                    onChange={(event) => setSelectedAgentId(event.target.value)}
                  >
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.fullName} ({agent.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleAssignAgent()}
                    disabled={
                      loadingAgents || assigningAgent || !selectedAgentId
                    }
                  >
                    {assigningAgent ? "Assigning..." : "Assign New User +"}
                  </button>
                </div>
              </div>

              {loadingAgents ? (
                <p className="status-note">Loading users...</p>
              ) : null}

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
                  {!loadingAgents && assignedAgents.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <p className="status-note">No users assigned.</p>
                      </td>
                    </tr>
                  ) : null}

                  {assignedAgents.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>
                        {assignment.agent?.fullName ?? assignment.agentId}
                      </td>
                      <td>{assignment.agent?.email ?? "-"}</td>
                      <td>{assignment.agent?.role ?? "agent"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          disabled={removingAgentId === assignment.agentId}
                          onClick={() =>
                            void handleRemoveAgent(assignment.agentId)
                          }
                        >
                          {removingAgentId === assignment.agentId
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "teams" ? (
            <div className="data-panel campaign-detail-tab-panel">
              <div className="campaign-detail-toolbar">
                <h3>Teams Assigned</h3>
                <div className="campaign-detail-toolbar-actions">
                  <select
                    value={selectedTeamId}
                    disabled={
                      loadingTeams || assigningTeam || teamOptions.length === 0
                    }
                    onChange={(event) => setSelectedTeamId(event.target.value)}
                  >
                    {teamOptions.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleAssignTeam()}
                    disabled={loadingTeams || assigningTeam || !selectedTeamId}
                  >
                    {assigningTeam ? "Assigning..." : "Assign New Team +"}
                  </button>
                </div>
              </div>

              {loadingTeams ? (
                <p className="status-note">Loading teams...</p>
              ) : null}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadingTeams && assignedTeams.length === 0 ? (
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
                            void handleRemoveTeam(assignment.teamId)
                          }
                        >
                          {removingTeamId === assignment.teamId
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "configurations" ? (
            <>
              <div className="data-panel campaign-detail-tab-panel">
                <div className="campaign-detail-toolbar">
                  <h3>Channel Mappings</h3>
                  <div className="campaign-detail-toolbar-actions">
                    <input
                      className="campaign-detail-inline-input"
                      placeholder={
                        isGmailMapping ? "Gmail address" : "External account id"
                      }
                      value={mappingForm.externalAccountId}
                      disabled={creatingMapping || !isMappingSupported}
                      onChange={(event) =>
                        setMappingForm((prev) => ({
                          ...prev,
                          externalAccountId: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="campaign-detail-inline-input campaign-detail-inline-input-sm"
                      type="number"
                      min={1}
                      value={mappingForm.priority}
                      disabled={creatingMapping || !isMappingSupported}
                      onChange={(event) =>
                        setMappingForm((prev) => ({
                          ...prev,
                          priority: Math.max(
                            1,
                            Number(event.target.value || 1),
                          ),
                        }))
                      }
                    />
                    <label className="slide-toggle-field">
                      <span>Active</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={mappingForm.isActive}
                        aria-label="Toggle active status"
                        className={`slide-toggle ${mappingForm.isActive ? "is-on" : "is-off"}`}
                        disabled={creatingMapping || !isMappingSupported}
                        onClick={() =>
                          setMappingForm((prev) => ({
                            ...prev,
                            isActive: !prev.isActive,
                          }))
                        }
                      >
                        <span className="slide-toggle-knob" />
                      </button>
                    </label>
                    {isGmailMapping ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          window.location.assign(gmailAuthorizeUrl)
                        }
                      >
                        Connect Gmail
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={
                        creatingMapping ||
                        !isMappingSupported ||
                        (isGmailMapping &&
                          (loadingGmailAccounts || !hasGmailAccount))
                      }
                      onClick={() => void handleCreateMapping()}
                    >
                      {creatingMapping ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                {!isMappingSupported ? (
                  <p className="status-note">
                    Channel mappings are only available for external channels
                    (gmail, whatsapp, instagram, messenger).
                  </p>
                ) : null}

                {loadingMappings ? (
                  <p className="status-note">Loading configurations...</p>
                ) : null}

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>External Account ID</th>
                      <th>Priority</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loadingMappings && mappings.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <p className="status-note">
                            No configurations found.
                          </p>
                        </td>
                      </tr>
                    ) : null}

                    {mappings.map((mapping) => (
                      <tr key={mapping.id}>
                        <td>
                          <span
                            className={`status-badge channel-${mapping.channel}`}
                          >
                            {mapping.channel}
                          </span>
                        </td>
                        <td>{mapping.externalAccountId}</td>
                        <td>{mapping.priority}</td>
                        <td>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={mapping.isActive}
                            aria-label={`Toggle ${mapping.externalAccountId} active status`}
                            className={`slide-toggle ${mapping.isActive ? "is-on" : "is-off"}`}
                            disabled={
                              togglingMappingId === mapping.id ||
                              deletingMappingId === mapping.id
                            }
                            onClick={() =>
                              void handleToggleMappingActive(mapping)
                            }
                          >
                            <span className="slide-toggle-knob" />
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="danger"
                            disabled={deletingMappingId === mapping.id}
                            onClick={() => void handleDeleteMapping(mapping.id)}
                          >
                            {deletingMappingId === mapping.id
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeTab === "interactions" ? (
            <div className="data-panel campaign-detail-tab-panel">
              <div className="campaign-detail-toolbar">
                <h3>Interaction History</h3>
              </div>

              {loadingInteractionHistory ? (
                <p className="status-note">Loading interactions...</p>
              ) : null}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Agent</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadingInteractionHistory &&
                  interactionHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <p className="status-note">No interactions found.</p>
                      </td>
                    </tr>
                  ) : null}

                  {interactionHistory.map((session) => (
                    <tr key={session.id}>
                      <td>{session.contactName ?? session.contactId}</td>
                      <td>{session.agentName ?? session.agentId ?? "-"}</td>
                      <td>
                        <span
                          className={`status-badge channel-${session.channel}`}
                        >
                          {session.channel}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge status-${session.status}`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td>
                        {session.startedAt
                          ? new Date(session.startedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        {session.endedAt
                          ? new Date(session.endedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary interaction-view-btn"
                          onClick={() => setViewingInteraction(session)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {viewingInteraction ? (
            <div
              className="confirm-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Interaction detail"
              onClick={() => setViewingInteraction(null)}
            >
              <div
                className="confirm-dialog interaction-detail-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <h3>Chat History</h3>

                <div className="interaction-chat-history">
                  <p className="status-note">
                    Session ID:{" "}
                    <strong>{shortId(viewingInteraction.id)}</strong>
                  </p>

                  {chatLoading ? (
                    <p className="status-note">Loading chat history...</p>
                  ) : null}

                  {chatError ? <p className="error-note">{chatError}</p> : null}

                  {!chatLoading && !chatError && chatMessages.length === 0 ? (
                    <p className="status-note">
                      No messages in this interaction.
                    </p>
                  ) : null}

                  {!chatLoading && !chatError && chatMessages.length > 0 ? (
                    <div className="interaction-chat-thread">
                      {chatMessages.map((message) => (
                        <article
                          key={message.id}
                          className={`interaction-chat-bubble sender-${message.senderType}`}
                        >
                          <header>
                            <strong>{toSenderLabel(message.senderType)}</strong>
                            <span>{formatDateTime(message.createdAt)}</span>
                          </header>
                          <p>{message.content}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="confirm-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setViewingInteraction(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatDateTime(input: string | null) {
  if (!input) {
    return "-";
  }

  return new Date(input).toLocaleString();
}

function toSenderLabel(senderType: ChatMessage["senderType"]) {
  if (senderType === "agent") {
    return "Agent";
  }

  if (senderType === "customer") {
    return "Customer";
  }

  return "System";
}
