import type { ReactNode } from "react";

type AdminFormSectionProps = {
  children: ReactNode;
  className?: string;
  copy?: ReactNode;
  title: ReactNode;
};

export function AdminFormSection({
  children,
  className = "",
  copy,
  title,
}: AdminFormSectionProps) {
  return (
    <div className={`admin-form-section ${className}`}>
      <div className="admin-form-section-head">
        <h3 className="admin-form-section-title">{title}</h3>
        {copy ? <p className="admin-form-section-copy">{copy}</p> : null}
      </div>
      {children}
    </div>
  );
}
