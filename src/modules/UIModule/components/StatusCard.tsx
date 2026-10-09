import type { ReactNode } from "react";
export default function StatusCard({
  title,
  description,
  loading = false,
  children,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="status-card">
      {loading && <span className="spinner" aria-hidden="true" />}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
