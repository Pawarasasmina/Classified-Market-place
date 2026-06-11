import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  actions?: ReactNode;
  badge?: ReactNode;
  description: ReactNode;
  eyebrow: string;
  title: ReactNode;
};

export function AdminPageHeader({
  actions,
  badge,
  description,
  eyebrow,
  title,
}: AdminPageHeaderProps) {
  return (
    <section className="panel admin-page-header">
      <div className="admin-page-header-copy">
        <p className="admin-page-header-eyebrow">{eyebrow}</p>
        <h1 className="admin-page-header-title">{title}</h1>
        <p className="admin-page-header-description">{description}</p>
      </div>
      {badge || actions ? (
        <div className="admin-page-header-aside">
          {badge ? <div className="admin-page-header-badge">{badge}</div> : null}
          {actions ? (
            <div className="admin-page-header-actions">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
