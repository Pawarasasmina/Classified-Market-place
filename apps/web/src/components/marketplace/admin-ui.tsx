import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2.25rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--accent-soft),var(--surface))] p-6 shadow-[0_18px_46px_rgba(17,24,45,0.10)]">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(102,104,232,0.22),transparent_68%)]" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[var(--foreground)]">{title}</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--muted)]">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface),color-mix(in_srgb,var(--surface)_82%,var(--background)))] p-5 shadow-[0_18px_42px_rgba(17,24,45,0.08)]">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{value}</p>
      {note ? <p className="mt-2 text-xs text-[var(--muted)]">{note}</p> : null}
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: "pending" | "approved" | "rejected" | "removed" | "banned" | "verified" | "active" | "draft";
}) {
  const style: Record<typeof status, string> = {
    pending: "bg-[rgba(163,110,29,0.16)] text-[var(--accent)]",
    approved: "bg-[rgba(33,161,121,0.16)] text-[#1f7c61]",
    rejected: "bg-[rgba(185,56,32,0.14)] text-[#8f2e1c]",
    removed: "bg-[rgba(185,56,32,0.14)] text-[#8f2e1c]",
    banned: "bg-[rgba(185,56,32,0.14)] text-[#8f2e1c]",
    verified: "bg-[rgba(33,161,121,0.16)] text-[#1f7c61]",
    active: "bg-[rgba(102,104,232,0.16)] text-[var(--brand-deep)]",
    draft: "bg-[rgba(103,106,119,0.16)] text-[var(--muted)]",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${style[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

export function ChartBars({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface),color-mix(in_srgb,var(--surface)_84%,var(--background)))] p-5 shadow-[0_18px_42px_rgba(17,24,45,0.08)]">
      <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_72%,var(--line))]">
              <div
                className="h-2 rounded-full bg-[linear-gradient(135deg,#6668E8,#4F57D8)]"
                style={{ width: `${Math.max(8, Math.round((item.value / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPanel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface),color-mix(in_srgb,var(--surface)_86%,var(--background)))] p-6 shadow-[0_18px_48px_rgba(17,24,45,0.09)]">
      <div className="flex items-center justify-between gap-4">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          {title}
        </p>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-strong)_72%,var(--surface))] px-4 py-6 text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
