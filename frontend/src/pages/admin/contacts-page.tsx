import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "../../components/common/confirm-dialog";
import { CrudFormCard } from "../../components/common/crud-form-card";
import { PaginationControls } from "../../components/common/pagination-controls";
import { RowActionButtons } from "../../components/common/row-action-buttons";
import {
  createContact,
  deleteContact,
  getContacts,
  updateContact,
  type Contact,
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

  return (
    <section className="placeholder-page">
      <h1>Contacts</h1>
      <p>Create, update and delete contact records.</p>

      <p className="status-note">
        {meta?.total !== undefined ? `Total contacts: ${meta.total}` : null}
      </p>
      {loading ? <p className="status-note">Loading contacts...</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <CrudFormCard
        title="Create Contact"
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
