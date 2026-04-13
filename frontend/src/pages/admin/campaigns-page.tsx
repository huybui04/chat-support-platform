import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import { RowActionButtons } from "../../components/common/row-action-buttons";
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
  startDate: string;
  endDate: string;
};

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

  return (
    <section className="placeholder-page">
      <h1>Campaign Management</h1>
      <p>Create, update and remove campaigns from supervisor portal.</p>

      <p className="status-note">
        {meta?.total !== undefined ? `Total campaigns: ${meta.total}` : null}
      </p>
      {loading ? <p className="status-note">Loading campaigns...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

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

      <PaginationControls
        page={page}
        limit={PAGE_SIZE}
        total={meta?.total}
        currentCount={items.length}
        loading={loading}
        onPageChange={setPage}
      />

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
