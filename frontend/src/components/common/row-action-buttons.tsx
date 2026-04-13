type RowActionButtonsProps = {
  editing: boolean;
  saving: boolean;
  deletingDisabled?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function RowActionButtons({
  editing,
  saving,
  deletingDisabled = false,
  onSave,
  onCancel,
  onEdit,
  onDelete,
}: RowActionButtonsProps) {
  return (
    <div className="row-actions">
      {editing ? (
        <>
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={onDelete}
            disabled={deletingDisabled}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
