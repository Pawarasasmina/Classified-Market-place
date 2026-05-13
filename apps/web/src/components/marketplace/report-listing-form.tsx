"use client";

import { useActionState } from "react";
import { reportListingAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

const reportReasons = [
  { value: "SPAM", label: "Spam or scam" },
  { value: "FRAUD", label: "Fraud or suspicious payment request" },
  { value: "OFFENSIVE", label: "Offensive or unsafe content" },
  { value: "MISLEADING", label: "Misleading description or price" },
  { value: "PROHIBITED_ITEM", label: "Prohibited item or service" },
  { value: "OTHER", label: "Other" },
] as const;

export function ReportListingForm({
  listingId,
  currentPath,
}: {
  listingId: string;
  currentPath: string;
}) {
  const [state, formAction, pending] = useActionState(
    reportListingAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="currentPath" value={currentPath} />

      <div>
        <label
          htmlFor={`report-reason-${listingId}`}
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
        >
          Report listing
        </label>
        <select
          id={`report-reason-${listingId}`}
          name="reason"
          defaultValue="MISLEADING"
          disabled={pending}
          className="w-full rounded-[1rem] border border-[var(--line)] bg-[rgba(9,12,26,0.55)] px-3 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reportReasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <textarea
          name="details"
          disabled={pending}
          rows={3}
          placeholder="Optional details to help moderation review this listing."
          className="w-full resize-none rounded-[1rem] border border-[var(--line)] bg-[rgba(9,12,26,0.55)] px-3 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {state.fieldErrors?.reason ? (
        <p className="text-sm text-[#b93820]">{state.fieldErrors.reason}</p>
      ) : null}

      {state.fieldErrors?.details ? (
        <p className="text-sm text-[#b93820]">{state.fieldErrors.details}</p>
      ) : null}

      {state.message ? (
        <p className="rounded-[1rem] border border-[rgba(102,104,232,0.25)] bg-[rgba(9,12,26,0.55)] px-3 py-3 text-sm text-[var(--foreground)]">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full border border-[var(--line)] bg-[rgba(9,12,26,0.45)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting report..." : "Submit report"}
      </button>
    </form>
  );
}
