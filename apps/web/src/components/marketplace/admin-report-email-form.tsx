"use client";

import { sendAdminReportEmailAction } from "@/app/(main)/actions";
import type {
  AdminReportEmailFilters,
  AdminReportEmailType,
} from "@/lib/marketplace-api";
import { useFormStatus } from "react-dom";

type AdminReportEmailFormProps = {
  filters: AdminReportEmailFilters;
  message?: string;
  reportType: AdminReportEmailType;
  returnTo: string;
  status?: string;
};

function statusClass(status?: string) {
  if (status === "success") {
    return "border-emerald-300/40 bg-emerald-500/10 text-[var(--success-text)]";
  }

  if (status === "disabled") {
    return "border-amber-300/40 bg-amber-500/10 text-[var(--warning-text)]";
  }

  return "border-red-300/40 bg-red-500/10 text-[var(--danger-text)]";
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="action-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Sending..." : "Send email"}
    </button>
  );
}

export function AdminReportEmailForm({
  filters,
  message,
  reportType,
  returnTo,
  status,
}: AdminReportEmailFormProps) {
  return (
    <div className="grid w-full gap-2 sm:w-auto">
      {status ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${statusClass(
            status,
          )}`}
        >
          {message ??
            (status === "success"
              ? "Report emailed."
              : "Report email request updated.")}
        </div>
      ) : null}
      <details className="group rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)]">
        <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-[var(--foreground)] group-open:border-b group-open:border-[var(--line)]">
          Email report
        </summary>
        <form action={sendAdminReportEmailAction} className="grid gap-3 p-4">
          <input type="hidden" name="reportType" value={reportType} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {filters.days ? (
            <input type="hidden" name="days" value={filters.days} />
          ) : null}
          {filters.from ? (
            <input type="hidden" name="from" value={filters.from} />
          ) : null}
          {filters.to ? (
            <input type="hidden" name="to" value={filters.to} />
          ) : null}
          {filters.take ? (
            <input type="hidden" name="take" value={filters.take} />
          ) : null}
          {filters.topTake ? (
            <input type="hidden" name="topTake" value={filters.topTake} />
          ) : null}

          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Recipient email</span>
            <input
              name="recipient"
              type="email"
              inputMode="email"
              placeholder="admin@example.com"
              className="w-full rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.64)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Note</span>
            <textarea
              name="message"
              rows={3}
              placeholder="Optional message for the recipient"
              className="w-full rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.64)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <SubmitButton />
        </form>
      </details>
    </div>
  );
}
