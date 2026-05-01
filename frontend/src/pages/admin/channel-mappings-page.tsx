import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { PaginationControls } from "../../components/common/pagination-controls";
import { RowActionButtons } from "../../components/common/row-action-buttons";
import {
  createChannelMapping,
  deleteChannelMapping,
  getCampaigns,
  getChannelMappings,
  updateChannelMapping,
  type Campaign,
  type ChannelMapping,
  type ExternalChannel,
} from "../../services/admin-api";
import { useToast } from "../../store/toast-context";
import { useCrudActions } from "../../store/use-crud-actions";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;
const CAMPAIGNS_FETCH_LIMIT = 100;
const CHANNELS: ExternalChannel[] = [
  "whatsapp",
  "instagram",
  "messenger",
  "gmail",
];

type MappingForm = {
  channel: ExternalChannel;
  externalAccountId: string;
  campaignId: string;
  priority: number;
  isActive: boolean;
};

type SortField = "priority" | "createdAt";
type SortDirection = "asc" | "desc";

const initialForm: MappingForm = {
  channel: "whatsapp",
  externalAccountId: "",
  campaignId: "",
  priority: 1,
  isActive: true,
};

function formatChannelLabel(channel: ExternalChannel) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "instagram") return "Instagram";
  if (channel === "gmail") return "Gmail";
  return "Messenger";
}

function getChannelBadgeClass(channel: ExternalChannel) {
  if (channel === "whatsapp") return "status-badge channel-whatsapp";
  if (channel === "instagram") return "status-badge channel-instagram";
  if (channel === "gmail") return "status-badge channel-gmail";
  return "status-badge channel-messenger";
}

export function AdminChannelMappingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showError, showSuccess } = useToast();
  const [items, setItems] = useState<ChannelMapping[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(() => {
    const rawPage = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [filterChannel, setFilterChannel] = useState<ExternalChannel | "all">(
    () => {
      const value = searchParams.get("channel");
      if (
        value === "whatsapp" ||
        value === "instagram" ||
        value === "messenger" ||
        value === "gmail"
      ) {
        return value;
      }

      return "all";
    },
  );
  const [filterActive, setFilterActive] = useState<
    "all" | "active" | "inactive"
  >(() => {
    const value = searchParams.get("active");
    if (value === "active" || value === "inactive") {
      return value;
    }

    return "all";
  });
  const [filterCampaignId, setFilterCampaignId] = useState<string>(
    () => searchParams.get("campaignId") ?? "all",
  );
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [sortField, setSortField] = useState<SortField>(() => {
    const value = searchParams.get("sortBy");
    return value === "priority" ? "priority" : "createdAt";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const value = searchParams.get("sortOrder");
    return value === "asc" ? "asc" : "desc";
  });
  const [createForm, setCreateForm] = useState<MappingForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MappingForm>(initialForm);
  const [mappingIdToDelete, setMappingIdToDelete] = useState<string | null>(
    null,
  );
  const { creating, savingId, deleting, runCreate, runSave, runDelete } =
    useCrudActions();
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";
  const gmailStatus = searchParams.get("gmail");
  const gmailAuthorizeUrl = useMemo(() => {
    const returnUrl = window.location.href;
    const encoded = encodeURIComponent(returnUrl);
    return `${apiBaseUrl}/gmail/oauth/authorize?returnUrl=${encoded}`;
  }, [apiBaseUrl]);

  const campaignNameById = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const campaign of campaigns) {
      lookup.set(campaign.id, campaign.name);
    }
    return lookup;
  }, [campaigns]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items.filter((mapping) => {
      if (!normalizedKeyword) {
        return true;
      }

      const campaignName =
        campaignNameById.get(mapping.campaignId)?.toLowerCase() ?? "";

      return (
        mapping.externalAccountId.toLowerCase().includes(normalizedKeyword) ||
        mapping.campaignId.toLowerCase().includes(normalizedKeyword) ||
        campaignName.includes(normalizedKeyword)
      );
    });
  }, [campaignNameById, items, keyword]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((left, right) => {
      if (sortField === "priority") {
        const delta = left.priority - right.priority;
        return sortDirection === "asc" ? delta : -delta;
      }

      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      const delta = leftTime - rightTime;
      return sortDirection === "asc" ? delta : -delta;
    });

    return sorted;
  }, [filteredItems, sortDirection, sortField]);

  const activeCount = useMemo(
    () => sortedItems.filter((mapping) => mapping.isActive).length,
    [sortedItems],
  );

  const toggleSort = (field: SortField) => {
    setPage(1);
    setSortField((currentField) => {
      if (currentField !== field) {
        setSortDirection("desc");
        return field;
      }

      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return currentField;
    });
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return "-";
    }

    return sortDirection === "asc" ? "↑" : "↓";
  };

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getChannelMappings({
        page,
        limit: PAGE_SIZE,
        channel: filterChannel === "all" ? undefined : filterChannel,
        isActive:
          filterActive === "all"
            ? undefined
            : filterActive === "active"
              ? true
              : false,
        campaignId: filterCampaignId === "all" ? undefined : filterCampaignId,
        sortBy: sortField,
        sortOrder: sortDirection,
      });
      setItems(result.items);
      setMeta(result.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load channel mappings",
      );
    } finally {
      setLoading(false);
    }
  }, [
    filterActive,
    filterCampaignId,
    filterChannel,
    page,
    sortDirection,
    sortField,
  ]);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  useEffect(() => {
    if (gmailStatus === "success") {
      showSuccess("Gmail connected successfully");
    }
  }, [gmailStatus, showSuccess]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));

    if (filterChannel !== "all") {
      params.set("channel", filterChannel);
    }

    if (filterActive !== "all") {
      params.set("active", filterActive);
    }

    if (filterCampaignId !== "all") {
      params.set("campaignId", filterCampaignId);
    }

    if (keyword.trim()) {
      params.set("q", keyword.trim());
    }

    params.set("sortBy", sortField);
    params.set("sortOrder", sortDirection);

    setSearchParams(params, { replace: true });
  }, [
    filterActive,
    filterCampaignId,
    filterChannel,
    keyword,
    page,
    setSearchParams,
    sortDirection,
    sortField,
  ]);
  useEffect(() => {
    let cancelled = false;

    const loadCampaignOptions = async () => {
      setCampaignsLoading(true);
      try {
        let page = 1;
        let total = Number.MAX_SAFE_INTEGER;
        const mergedCampaigns: Campaign[] = [];

        while (mergedCampaigns.length < total) {
          const result = await getCampaigns({
            page,
            limit: CAMPAIGNS_FETCH_LIMIT,
          });

          if (result.items.length === 0) {
            break;
          }

          mergedCampaigns.push(...result.items);
          total = result.meta?.total ?? mergedCampaigns.length;
          page += 1;
        }

        const dedupedCampaigns = Array.from(
          new Map(
            mergedCampaigns.map((campaign) => [campaign.id, campaign]),
          ).values(),
        );

        if (cancelled) {
          return;
        }

        setCampaigns(dedupedCampaigns);
        const firstCampaignId = dedupedCampaigns[0]?.id ?? "";
        setCreateForm((prev) => ({
          ...prev,
          campaignId: prev.campaignId || firstCampaignId,
        }));
      } catch (caughtError) {
        if (!cancelled) {
          showError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load campaigns",
          );
        }
      } finally {
        if (!cancelled) {
          setCampaignsLoading(false);
        }
      }
    };

    void loadCampaignOptions();

    return () => {
      cancelled = true;
    };
  }, [showError]);

  const handleCreate = async () => {
    if (!createForm.externalAccountId.trim()) {
      showError("External account id is required");
      return;
    }

    if (!createForm.campaignId) {
      showError("Campaign is required");
      return;
    }

    const created = await runCreate(
      async () =>
        createChannelMapping({
          channel: createForm.channel,
          externalAccountId: createForm.externalAccountId.trim(),
          campaignId: createForm.campaignId,
          priority: createForm.priority,
          isActive: createForm.isActive,
        }),
      "Failed to create channel mapping",
    );

    if (created) {
      showSuccess("Channel mapping created successfully");
      setCreateForm((prev) => ({
        ...initialForm,
        campaignId: prev.campaignId,
      }));
      await loadMappings();
    }
  };

  const startEdit = (mapping: ChannelMapping) => {
    setEditingId(mapping.id);
    setEditForm({
      channel: mapping.channel,
      externalAccountId: mapping.externalAccountId,
      campaignId: mapping.campaignId,
      priority: mapping.priority,
      isActive: mapping.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialForm);
  };

  const saveEdit = async (id: string) => {
    if (!editForm.externalAccountId.trim()) {
      showError("External account id is required");
      return;
    }

    if (!editForm.campaignId) {
      showError("Campaign is required");
      return;
    }

    const updated = await runSave(
      id,
      async () =>
        updateChannelMapping(id, {
          channel: editForm.channel,
          externalAccountId: editForm.externalAccountId.trim(),
          campaignId: editForm.campaignId,
          priority: editForm.priority,
          isActive: editForm.isActive,
        }),
      "Failed to update channel mapping",
    );

    if (updated) {
      showSuccess("Channel mapping updated successfully");
      cancelEdit();
      await loadMappings();
    }
  };

  const removeMapping = async () => {
    if (!mappingIdToDelete) {
      return;
    }

    const deleted = await runDelete(
      async () => deleteChannelMapping(mappingIdToDelete),
      "Failed to deactivate channel mapping",
    );

    if (deleted !== undefined) {
      showSuccess("Channel mapping deactivated");
      setMappingIdToDelete(null);
      await loadMappings();
    }
  };

  return (
    <section className="placeholder-page channel-mapping-page">
      <header className="channel-mapping-hero">
        <div>
          <p className="eyebrow">Supervisor Console</p>
          <h1>Channel Mapping Management</h1>
          <p>
            Map external account identifiers from WhatsApp, Instagram,
            Messenger, and Gmail into active campaigns for inbound routing.
          </p>
        </div>
        <div className="channel-mapping-hero-meta">
          <span className="status-badge active">Omnichannel ready</span>
          <span className="status-badge connected">
            {meta?.total ?? 0} mappings
          </span>
          <button
            type="button"
            className="secondary"
            onClick={() => window.location.assign(gmailAuthorizeUrl)}
          >
            Connect Gmail
          </button>
        </div>
      </header>

      <div className="channel-mapping-kpi-grid">
        <article>
          <h2>Total</h2>
          <p>{meta?.total ?? 0}</p>
        </article>
        <article>
          <h2>Visible Rows</h2>
          <p>{sortedItems.length}</p>
        </article>
        <article>
          <h2>Active Rows</h2>
          <p>{activeCount}</p>
        </article>
        <article>
          <h2>Channel Scope</h2>
          <p>
            {filterChannel === "all"
              ? "All"
              : formatChannelLabel(filterChannel)}
          </p>
        </article>
      </div>

      {loading ? <p className="status-note">Loading mappings...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <section className="crud-form channel-mapping-create">
        <h2>Create Mapping</h2>
        <p className="status-note">
          Use exact external account id from provider webhook metadata.
        </p>
        <div className="crud-form-grid">
          <label>
            Channel
            <select
              value={createForm.channel}
              disabled={creating}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  channel: event.target.value as ExternalChannel,
                }))
              }
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {formatChannelLabel(channel)}
                </option>
              ))}
            </select>
          </label>

          <label>
            External Account ID
            <input
              placeholder="phone_number_id / page_id / ig_business_id / gmail"
              value={createForm.externalAccountId}
              disabled={creating}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  externalAccountId: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Campaign
            <select
              value={createForm.campaignId}
              disabled={creating || campaignsLoading}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  campaignId: event.target.value,
                }))
              }
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <input
              type="number"
              min={1}
              value={createForm.priority}
              disabled={creating}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  priority: Math.max(1, Number(event.target.value || 1)),
                }))
              }
            />
          </label>

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

          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating..." : "Create Mapping"}
          </button>
        </div>
      </section>

      <div className="channel-mapping-toolbar">
        <label>
          Channel
          <select
            value={filterChannel}
            onChange={(event) => {
              setFilterChannel(event.target.value as ExternalChannel | "all");
              setPage(1);
            }}
          >
            <option value="all">All channels</option>
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {formatChannelLabel(channel)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Campaign
          <select
            value={filterCampaignId}
            onChange={(event) => {
              setFilterCampaignId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select
            value={filterActive}
            onChange={(event) => {
              setFilterActive(
                event.target.value as "all" | "active" | "inactive",
              );
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </label>

        <label className="channel-mapping-search">
          Search
          <input
            placeholder="External account id / campaign name / campaign id"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
      </div>

      <div className="data-panel channel-mapping-table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>External Account ID</th>
              <th>Campaign</th>
              <th>
                <button
                  type="button"
                  className="table-sort-button"
                  onClick={() => toggleSort("priority")}
                >
                  Priority {sortIndicator("priority")}
                </button>
              </th>
              <th>Active</th>
              <th>
                <button
                  type="button"
                  className="table-sort-button"
                  onClick={() => toggleSort("createdAt")}
                >
                  Created At {sortIndicator("createdAt")}
                </button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && sortedItems.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <p className="status-note">
                    No mappings found for current filters.
                  </p>
                </td>
              </tr>
            ) : null}

            {sortedItems.map((mapping) => (
              <tr key={mapping.id}>
                <td>
                  {editingId === mapping.id ? (
                    <select
                      value={editForm.channel}
                      disabled={savingId === mapping.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          channel: event.target.value as ExternalChannel,
                        }))
                      }
                    >
                      {CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={getChannelBadgeClass(mapping.channel)}>
                      {formatChannelLabel(mapping.channel)}
                    </span>
                  )}
                </td>
                <td>
                  {editingId === mapping.id ? (
                    <input
                      value={editForm.externalAccountId}
                      disabled={savingId === mapping.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          externalAccountId: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    mapping.externalAccountId
                  )}
                </td>
                <td>
                  {editingId === mapping.id ? (
                    <select
                      value={editForm.campaignId}
                      disabled={savingId === mapping.id || campaignsLoading}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          campaignId: event.target.value,
                        }))
                      }
                    >
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (campaignNameById.get(mapping.campaignId) ??
                    mapping.campaignId)
                  )}
                </td>
                <td>
                  {editingId === mapping.id ? (
                    <input
                      type="number"
                      min={1}
                      value={editForm.priority}
                      disabled={savingId === mapping.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          priority: Math.max(
                            1,
                            Number(event.target.value || 1),
                          ),
                        }))
                      }
                    />
                  ) : (
                    mapping.priority
                  )}
                </td>
                <td>
                  {editingId === mapping.id ? (
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      disabled={savingId === mapping.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                  ) : mapping.isActive ? (
                    <span className="status-badge online">yes</span>
                  ) : (
                    <span className="status-badge offline">no</span>
                  )}
                </td>
                <td>{new Date(mapping.createdAt).toLocaleString()}</td>
                <td>
                  <RowActionButtons
                    editing={editingId === mapping.id}
                    saving={savingId === mapping.id}
                    deletingDisabled={deleting}
                    onSave={() => void saveEdit(mapping.id)}
                    onCancel={cancelEdit}
                    onEdit={() => startEdit(mapping)}
                    onDelete={() => setMappingIdToDelete(mapping.id)}
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
        currentCount={sortedItems.length}
        loading={loading}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={Boolean(mappingIdToDelete)}
        title="Deactivate mapping"
        message="This action will deactivate the mapping and stop inbound routing for it."
        confirmLabel="Deactivate"
        confirmLoading={deleting}
        onCancel={() => setMappingIdToDelete(null)}
        onConfirm={() => void removeMapping()}
      />
    </section>
  );
}
