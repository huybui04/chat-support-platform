import type { PropsWithChildren } from "react";

type CrudFormCardProps = PropsWithChildren<{
  title: string;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  onSubmit: () => void;
}>;

export function CrudFormCard({
  title,
  submitLabel,
  submittingLabel,
  submitting,
  onSubmit,
  children,
}: CrudFormCardProps) {
  return (
    <div className="crud-form">
      <h2>{title}</h2>
      <div className="crud-form-grid">{children}</div>
      <div className="page-actions">
        <button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
