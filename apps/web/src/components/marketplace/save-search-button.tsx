"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import {
  createSavedSearchAction,
  deleteSavedSearchAction,
} from "@/app/(main)/actions";
import type { MarketplaceSavedSearch } from "@/lib/marketplace";

export function SaveSearchButton({
  query,
  categorySlug,
  sort,
  currentPath,
  initialSavedSearch,
  disabled = false,
}: {
  query: string;
  categorySlug: string;
  sort: "newest" | "price_asc" | "price_desc";
  currentPath: string;
  initialSavedSearch: MarketplaceSavedSearch | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [savedSearch, setSavedSearch] = useState(initialSavedSearch);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    if (disabled) {
      return;
    }

    setPending(true);
    setMessage(null);

    startTransition(async () => {
      try {
        if (savedSearch) {
          const response = await deleteSavedSearchAction(savedSearch.id, currentPath);
          setSavedSearch(null);
          setMessage(response.message);
        } else {
          const response = await createSavedSearchAction(
            {
              query,
              categorySlug,
              sort,
              alertsEnabled: true,
            },
            currentPath
          );
          setSavedSearch(response.savedSearch);
          setMessage(response.message);
        }

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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || disabled}
        className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Updating..."
          : savedSearch
            ? "Remove saved search"
            : "Save this search"}
      </button>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
