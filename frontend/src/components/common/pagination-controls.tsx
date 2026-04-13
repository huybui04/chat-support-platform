type PaginationControlsProps = {
  page: number;
  limit: number;
  total?: number;
  currentCount: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  limit,
  total,
  currentCount,
  loading = false,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages =
    total !== undefined ? Math.max(1, Math.ceil(total / limit)) : undefined;

  const canGoPrevious = !loading && page > 1;
  const canGoNext =
    !loading &&
    (totalPages !== undefined ? page < totalPages : currentCount >= limit);

  return (
    <div className="page-actions pagination-controls">
      <button
        type="button"
        className="secondary"
        onClick={() => onPageChange(page - 1)}
        disabled={!canGoPrevious}
      >
        Previous
      </button>
      <span className="status-note">
        Page {page}
        {totalPages !== undefined ? ` / ${totalPages}` : ""}
      </span>
      <button
        type="button"
        className="secondary"
        onClick={() => onPageChange(page + 1)}
        disabled={!canGoNext}
      >
        Next
      </button>
      {total !== undefined ? (
        <span className="status-note">Total: {total}</span>
      ) : null}
    </div>
  );
}
