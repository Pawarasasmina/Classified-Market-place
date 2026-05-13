"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import {
  deleteSavedSearchAction,
  updateSavedSearchAction,
} from "@/app/(main)/actions";
import {
  formatSavedSearchSortLabel,
  type MarketplaceSavedSearch,
} from "@/lib/marketplace";

export function SavedSearchCard({
  savedSearch,
  currentPath,
}: {
  savedSearch: MarketplaceSavedSearch;
  currentPath: string;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(savedSearch.label);
  const [alertsEnabled, setAlertsEnabled] = useState(savedSearch.alertsEnabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const normalizedLabel = label.trim();
  const hasChanges =
    normalizedLabel !== savedSearch.label || alertsEnabled !== savedSearch.alertsEnabled;

  function handleSave() {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await updateSavedSearchAction(
          savedSearch.id,
          {
            label: normalizedLabel || savedSearch.label,
            alertsEnabled,
          },
          currentPath
        );

        setLabel(response.savedSearch.label);
        setAlertsEnabled(response.savedSearch.alertsEnabled);
        setMessage(response.message);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "We could not update this saved search."
        );
      } finally {
        setPending(false);
      }
    });
  }

  function handleDelete() {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await deleteSavedSearchAction(savedSearch.id, currentPath);
        setMessage(response.message);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "We could not remove this saved search."
        );
        setPending(false);
      }
    });
  }

  return (
    <article className="rounded-[1.75rem] border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Search name
          </label>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={120}
            className="mt-2 w-full rounded-[1rem] border border-[var(--line)] bg-[rgba(255,250,244,0.58)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] outline-none"
          />
        </div>
        <Link
          href={savedSearch.href}
          className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--surface)]"
        >
          Open search
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {savedSearch.query ? (
          <span className="rounded-full border border-[var(--line)] bg-[rgba(255,250,244,0.65)] px-3 py-1.5 text-xs text-[var(--muted)]">
            Query: {savedSearch.query}
          </span>
        ) : null}
        {savedSearch.categoryName ? (
          <span className="rounded-full border border-[var(--line)] bg-[rgba(255,250,244,0.65)] px-3 py-1.5 text-xs text-[var(--muted)]">
            Category: {savedSearch.categoryName}
          </span>
        ) : null}
        <span className="rounded-full border border-[var(--line)] bg-[rgba(255,250,244,0.65)] px-3 py-1.5 text-xs text-[var(--muted)]">
          Sort: {formatSavedSearchSortLabel(savedSearch.sort)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{savedSearch.summary}</p>

      <label className="mt-4 flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
        <input
          type="checkbox"
          checked={alertsEnabled}
          onChange={(event) => setAlertsEnabled(event.target.checked)}
          className="h-4 w-4 rounded border-[var(--line)]"
        />
        Keep alerts enabled for this search
      </label>

      <p className="mt-3 text-xs text-[var(--muted)]">
        Saved {savedSearch.createdAtLabel}. Last updated {savedSearch.updatedAtLabel}.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !hasChanges}
          className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Updating..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete
        </button>
      </div>

      {message ? <p className="mt-3 text-xs text-[var(--muted)]">{message}</p> : null}
    </article>
  );
}
