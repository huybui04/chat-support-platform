import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import { RowActionButtons } from "../../components/common/row-action-buttons";
import {
  createContact,
  deleteContact,
  getCampaignImportLogs,
  getCampaigns,
  getContacts,
  importCampaignContactsCsv,
  type Campaign,
  type CampaignImportLog,
  updateContact,
  type Contact,
  type ImportCsvMapping,
} from "../../services/admin-api";
import { useToast } from "../../store/toast-context";
import { useCrudActions } from "../../store/use-crud-actions";
import type { ApiMeta } from "../../types/api";

const PAGE_SIZE = 20;

type ContactForm = {
  fullName: string;
  email: string;
  phone: string;
  whatsappId: string;
};

const initialForm: ContactForm = {
  fullName: "",
  email: "",
  phone: "",
  whatsappId: "",
};

const initialMappingForm: ImportCsvMapping = {
  full_name: "full_name",
  phone: "phone",
  email: "email",
};

export function AdminContactsPage() {
  const { showError, showSuccess } = useToast();
  const [items, setItems] = useState<Contact[]>([]);
  const [meta, setMeta] = useState<ApiMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState<ContactForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ContactForm>(initialForm);
  const [contactIdToDelete, setContactIdToDelete] = useState<string | null>(
    null,
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [importCampaignId, setImportCampaignId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [mappingForm, setMappingForm] =
    useState<ImportCsvMapping>(initialMappingForm);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importLogs, setImportLogs] = useState<CampaignImportLog[]>([]);
  const [importLogsLoading, setImportLogsLoading] = useState(false);
  const [importLogsError, setImportLogsError] = useState("");
  const { creating, savingId, deleting, runCreate, runSave, runDelete } =
    useCrudActions();

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getContacts({ page, limit: PAGE_SIZE });
      setItems(result.items);
      setMeta(result.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load contacts",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    let cancelled = false;

    const loadCampaigns = async () => {
      try {
        const result = await getCampaigns({ page: 1, limit: 100 });
        if (!cancelled) {
          setCampaigns(result.items);
          if (!importCampaignId && result.items.length > 0) {
            setImportCampaignId(result.items[0].id);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          showError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load campaigns",
          );
        }
      }
    };

    void loadCampaigns();

    return () => {
      cancelled = true;
    };
  }, [importCampaignId, showError]);

  useEffect(() => {
    if (!importCampaignId) {
      setImportLogs([]);
      setImportLogsError("");
      return;
    }

    let cancelled = false;

    const loadImportLogs = async () => {
      setImportLogsLoading(true);
      setImportLogsError("");
      try {
        const result = await getCampaignImportLogs(importCampaignId, {
          page: 1,
          limit: 10,
        });
        if (!cancelled) {
          setImportLogs(result.items);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setImportLogsError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load import logs",
          );
        }
      } finally {
        if (!cancelled) {
          setImportLogsLoading(false);
        }
      }
    };

    void loadImportLogs();

    return () => {
      cancelled = true;
    };
  }, [importCampaignId]);

  const handleCreate = async () => {
    if (!createForm.fullName.trim()) {
      showError("Contact name is required");
      return;
    }

    const created = await runCreate(
      async () =>
        createContact({
          fullName: createForm.fullName.trim(),
          email: toOptionalText(createForm.email),
          phone: toOptionalText(createForm.phone),
          whatsappId: toOptionalText(createForm.whatsappId),
        }),
      "Failed to create contact",
    );

    if (created) {
      setCreateForm(initialForm);
      showSuccess("Contact created successfully");
      await loadContacts();
    }
  };

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setEditForm({
      fullName: contact.fullName,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      whatsappId: contact.whatsappId ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialForm);
  };

  const saveEdit = async (id: string) => {
    if (!editForm.fullName.trim()) {
      showError("Contact name is required");
      return;
    }

    const updated = await runSave(
      id,
      async () =>
        updateContact(id, {
          fullName: editForm.fullName.trim(),
          email: toOptionalText(editForm.email),
          phone: toOptionalText(editForm.phone),
          whatsappId: toOptionalText(editForm.whatsappId),
        }),
      "Failed to update contact",
    );

    if (updated) {
      cancelEdit();
      showSuccess("Contact updated successfully");
      await loadContacts();
    }
  };

  const removeContact = async () => {
    if (!contactIdToDelete) {
      return;
    }

    const deleted = await runDelete(
      async () => deleteContact(contactIdToDelete),
      "Failed to delete contact",
    );

    if (deleted !== undefined) {
      showSuccess("Contact deleted successfully");
      setContactIdToDelete(null);
      await loadContacts();
    }
  };

  const importCsv = async () => {
    if (!importCampaignId) {
      showError("Please select a campaign");
      return;
    }
    if (!importFile) {
      showError("Please choose a CSV file to import");
      return;
    }
    if (!mappingForm.full_name.trim()) {
      showError("Please provide full_name column mapping");
      return;
    }

    setImportingCsv(true);
    try {
      const result = await importCampaignContactsCsv(
        importCampaignId,
        importFile,
        {
          full_name: mappingForm.full_name.trim(),
          phone: mappingForm.phone.trim(),
          email: mappingForm.email.trim(),
        },
      );

      showSuccess(
        `Import completed. Success: ${result.summary.successRows}, Failed: ${result.summary.failedRows}`,
      );
      setImportFile(null);
      const logs = await getCampaignImportLogs(importCampaignId, {
        page: 1,
        limit: 10,
      });
      setImportLogs(logs.items);
      await loadContacts();
    } catch (caughtError) {
      showError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to import campaign contacts",
      );
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <section className="placeholder-page">
      <h1>Contacts</h1>

      <p className="status-note">
        {meta?.total !== undefined ? `Total contacts: ${meta.total}` : null}
      </p>
      {loading ? <p className="status-note">Loading contacts...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <div className="crud-form">
        <h2>Import Contacts CSV</h2>
        <p className="status-note">
          Import theo campaign, có mapping cột CSV ({"full_name"} là bắt buộc).
        </p>
        <div className="crud-form-grid">
          <select
            value={importCampaignId}
            disabled={importingCsv || campaigns.length === 0}
            onChange={(event) => setImportCampaignId(event.target.value)}
          >
            {campaigns.length === 0 ? (
              <option value="">No campaign available</option>
            ) : null}
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importingCsv}
            onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
          />
          <input
            placeholder="full_name column"
            value={mappingForm.full_name}
            disabled={importingCsv}
            onChange={(event) =>
              setMappingForm((prev) => ({
                ...prev,
                full_name: event.target.value,
              }))
            }
          />
          <input
            placeholder="phone column"
            value={mappingForm.phone}
            disabled={importingCsv}
            onChange={(event) =>
              setMappingForm((prev) => ({
                ...prev,
                phone: event.target.value,
              }))
            }
          />
          <input
            placeholder="email column"
            value={mappingForm.email}
            disabled={importingCsv}
            onChange={(event) =>
              setMappingForm((prev) => ({
                ...prev,
                email: event.target.value,
              }))
            }
          />
        </div>
        <div className="page-actions">
          <button
            type="button"
            onClick={() => void importCsv()}
            disabled={importingCsv || campaigns.length === 0}
          >
            {importingCsv ? "Importing..." : "Import CSV"}
          </button>
        </div>

        <div className="data-panel">
          <h2>Recent Import Logs</h2>
          {importLogsLoading ? (
            <p className="status-note">Loading import logs...</p>
          ) : null}
          {importLogsError ? (
            <p className="error-note">{importLogsError}</p>
          ) : null}
          {!importLogsLoading && !importLogsError && importLogs.length === 0 ? (
            <p className="status-note">No import logs for selected campaign.</p>
          ) : null}
          {importLogs.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th>Failed</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {importLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.fileName}</td>
                    <td>{log.status}</td>
                    <td>{log.totalRows}</td>
                    <td>{log.successRows}</td>
                    <td>{log.failedRows}</td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      <CrudFormCard
        title="Create Contact (Manual)"
        submitLabel="Create contact"
        submittingLabel="Creating..."
        submitting={creating}
        onSubmit={() => void handleCreate()}
      >
        <input
          placeholder="Full name"
          value={createForm.fullName}
          disabled={creating}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))
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
        <input
          placeholder="Phone"
          value={createForm.phone}
          disabled={creating}
          onChange={(event) =>
            setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
          }
        />
        <input
          placeholder="WhatsApp ID"
          value={createForm.whatsappId}
          disabled={creating}
          onChange={(event) =>
            setCreateForm((prev) => ({
              ...prev,
              whatsappId: event.target.value,
            }))
          }
        />
      </CrudFormCard>

      <div className="data-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>WhatsApp ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((contact) => (
              <tr key={contact.id}>
                <td>
                  {editingId === contact.id ? (
                    <input
                      value={editForm.fullName}
                      disabled={savingId === contact.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          fullName: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    contact.fullName
                  )}
                </td>
                <td>
                  {editingId === contact.id ? (
                    <input
                      type="email"
                      value={editForm.email}
                      disabled={savingId === contact.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    (contact.email ?? "-")
                  )}
                </td>
                <td>
                  {editingId === contact.id ? (
                    <input
                      value={editForm.phone}
                      disabled={savingId === contact.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    (contact.phone ?? "-")
                  )}
                </td>
                <td>
                  {editingId === contact.id ? (
                    <input
                      value={editForm.whatsappId}
                      disabled={savingId === contact.id}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          whatsappId: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    (contact.whatsappId ?? "-")
                  )}
                </td>
                <td>
                  <RowActionButtons
                    editing={editingId === contact.id}
                    saving={savingId === contact.id}
                    deletingDisabled={deleting}
                    onSave={() => void saveEdit(contact.id)}
                    onCancel={cancelEdit}
                    onEdit={() => startEdit(contact)}
                    onDelete={() => setContactIdToDelete(contact.id)}
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
        open={Boolean(contactIdToDelete)}
        title="Delete contact"
        message="This action will remove the selected contact record."
        confirmLabel="Delete"
        confirmLoading={deleting}
        onCancel={() => setContactIdToDelete(null)}
        onConfirm={() => void removeContact()}
      />
    </section>
  );
}

function toOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
