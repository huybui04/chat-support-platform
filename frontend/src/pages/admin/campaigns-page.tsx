import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import {
  createCampaign,
  deleteCampaign,
  getCampaigns,
  getCurrentUser,
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
  type: Campaign["type"];
  startDate: string;
  endDate: string;
};

type CampaignManagementTab = "list" | "create";

const initialForm: CampaignForm = {
  name: "",
  description: "",
  status: "draft",
  channel: "whatsapp",
  type: "outbound",
  startDate: "",
  endDate: "",
};

export function AdminCampaignsPage() {
  const [searchParams] = useSearchParams();
  const { showError, showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<CampaignManagementTab>("list");
  const [items, setItems] = useState<Campaign[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState<CampaignForm>(initialForm);
  const [editForm, setEditForm] = useState<CampaignForm>(initialForm);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [campaignIdToDelete, setCampaignIdToDelete] = useState<string | null>(
    null,
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | Campaign["type"]>(
    "inbound",
  );

  const { creating, savingId, deleting, runCreate, runSave, runDelete } =
    useCrudActions();

  const inboundCount = useMemo(
    () => items.filter((campaign) => campaign.type === "inbound").length,
    [items],
  );

  const outboundCount = useMemo(
    () => items.filter((campaign) => campaign.type === "outbound").length,
    [items],
  );

  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return items.filter((campaign) => {
      const matchType = typeFilter === "all" || campaign.type === typeFilter;
      const matchKeyword =
        !keyword ||
        campaign.name.toLowerCase().includes(keyword) ||
        (campaign.description ?? "").toLowerCase().includes(keyword);

      return matchType && matchKeyword;
    });
  }, [items, searchKeyword, typeFilter]);

  const loadCampaigns = useCallback(
    async (targetPage: number = page) => {
      setLoading(true);
      setError("");
      try {
        const result = await getCampaigns({
          page: targetPage,
          limit: PAGE_SIZE,
        });
        setItems(result.items);
        setMeta(result.meta);
        return result;
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load campaigns",
        );
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [page],
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "list" || tab === "create") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

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
        type: createForm.type,
        startDate: toOptionalIsoString(createForm.startDate),
        endDate: toOptionalIsoString(createForm.endDate),
        createdById: currentUser.id,
      });
    }, "Failed to create campaign");

    if (created) {
      setCreateForm(initialForm);
      showSuccess("Campaign created successfully");
      await loadCampaigns();
      setActiveTab("list");
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

    if (deleted) {
      showSuccess("Campaign deleted successfully");
      setCampaignIdToDelete(null);
      const result = await loadCampaigns();
      if (result && result.items.length === 0 && page > 1) {
        setPage(page - 1);
      }
    }
  };

  const startEditCampaign = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id);
    setEditForm({
      name: campaign.name,
      description: campaign.description ?? "",
      status: campaign.status,
      channel: campaign.channel,
      type: campaign.type,
      startDate: toDateTimeLocal(campaign.startDate),
      endDate: toDateTimeLocal(campaign.endDate),
    });
  };

  const closeEditModal = () => {
    setEditingCampaignId(null);
    setEditForm(initialForm);
  };

  const saveEditedCampaign = async () => {
    if (!editingCampaignId) {
      return;
    }

    if (!editForm.name.trim()) {
      showError("Campaign name is required");
      return;
    }

    const updated = await runSave(
      editingCampaignId,
      async () =>
        updateCampaign(editingCampaignId, {
          name: editForm.name.trim(),
          description: toOptionalText(editForm.description),
          status: editForm.status,
          channel: editForm.channel,
          type: editForm.type,
          startDate: toOptionalIsoString(editForm.startDate),
          endDate: toOptionalIsoString(editForm.endDate),
        }),
      "Failed to update campaign",
    );

    if (updated) {
      showSuccess("Campaign updated successfully");
      closeEditModal();
      await loadCampaigns();
    }
  };

  return (
    <section className="placeholder-page">
      {/* <h1>Campaign Management</h1>
      {activeTab !== "list" ? (
        <p className="status-note">
          Manage campaigns by workflow: list and create.
        </p>
      ) : null} */}

      {/* <div
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
      </div> */}

      {activeTab === "create" ? (
        <>
          <div className="page-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setActiveTab("list")}
            >
              Back to list
            </button>
          </div>
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
              <option value="web" hidden>
                web
              </option>
              <option value="whatsapp">whatsapp</option>
              <option value="instagram" hidden>
                instagram
              </option>
              <option value="messenger">messenger</option>
              <option value="gmail">gmail</option>
            </select>
            <select
              value={createForm.type}
              disabled={creating}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  type: event.target.value as Campaign["type"],
                }))
              }
            >
              <option value="outbound">outbound</option>
              <option value="inbound">inbound</option>
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
        </>
      ) : null}

      {activeTab === "list" ? (
        <>
          <div className="campaign-overview">
            <p className="campaign-breadcrumb">
              All Campaigns
              {typeFilter !== "all"
                ? ` > ${typeFilter === "inbound" ? "Inbound Campaigns" : "Outbound Campaigns"}`
                : ""}
            </p>

            <div className="campaign-type-cards">
              <button
                type="button"
                className={`campaign-type-card ${
                  typeFilter === "inbound" ? "active" : ""
                }`}
                onClick={() => setTypeFilter("inbound")}
              >
                <span>Inbound Campaign</span>
                <strong>{inboundCount}</strong>
              </button>
              <button
                type="button"
                className={`campaign-type-card ${
                  typeFilter === "outbound" ? "active" : ""
                }`}
                onClick={() => setTypeFilter("outbound")}
              >
                <span>Outbound Campaign</span>
                <strong>{outboundCount}</strong>
              </button>
            </div>

            <div className="campaign-list-toolbar">
              <input
                placeholder="Search Campaign..."
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
              <button type="button" onClick={() => setActiveTab("create")}>
                Create New Campaign +
              </button>
            </div>
          </div>

          {loading ? <p className="status-note">Loading campaigns...</p> : null}
          {error ? <p className="error-note">{error}</p> : null}

          <div className="data-panel campaign-list-table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Channel Assigned</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link
                        className="campaign-name-link"
                        to={`/admin/campaigns/${campaign.id}`}
                      >
                        {campaign.name}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`status-badge channel-${campaign.channel}`}
                      >
                        {campaign.channel}
                      </span>
                    </td>
                    <td>{campaign.type}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          campaign.status === "active" ? "connected" : "pending"
                        }`}
                      >
                        {toStateLabel(campaign.status)}
                      </span>
                    </td>
                    <td>{campaign.startDate ?? "-"}</td>
                    <td>{campaign.endDate ?? "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => startEditCampaign(campaign)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={deleting}
                          onClick={() => setCampaignIdToDelete(campaign.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <p className="status-note">
                        No campaigns found for current filter.
                      </p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {activeTab === "list" ? (
        <PaginationControls
          page={page}
          limit={PAGE_SIZE}
          total={meta?.total}
          currentCount={filteredItems.length}
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

      {editingCampaignId ? (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-dialog campaign-edit-modal">
            <h3>Edit Campaign</h3>
            <div className="crud-form-grid">
              <input
                placeholder="Campaign name"
                value={editForm.name}
                disabled={savingId === editingCampaignId}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <input
                placeholder="Description (optional)"
                value={editForm.description}
                disabled={savingId === editingCampaignId}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
              <select
                value={editForm.status}
                disabled={savingId === editingCampaignId}
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
              <select
                value={editForm.channel}
                disabled={savingId === editingCampaignId}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    channel: event.target.value as Campaign["channel"],
                  }))
                }
              >
                <option value="web" hidden>
                  web
                </option>
                <option value="whatsapp">whatsapp</option>
                <option value="instagram" hidden>
                  instagram
                </option>
                <option value="messenger">messenger</option>
                <option value="gmail">gmail</option>
              </select>
              <select
                value={editForm.type}
                disabled={savingId === editingCampaignId}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    type: event.target.value as Campaign["type"],
                  }))
                }
              >
                <option value="outbound">outbound</option>
                <option value="inbound">inbound</option>
              </select>
              <input
                type="datetime-local"
                value={editForm.startDate}
                disabled={savingId === editingCampaignId}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
              <input
                type="datetime-local"
                value={editForm.endDate}
                disabled={savingId === editingCampaignId}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="secondary"
                onClick={closeEditModal}
                disabled={savingId === editingCampaignId}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEditedCampaign()}
                disabled={savingId === editingCampaignId}
              >
                {savingId === editingCampaignId ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function toStateLabel(status: Campaign["status"]) {
  if (status === "active") {
    return "Started";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "paused") {
    return "Paused";
  }

  return "Draft";
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
