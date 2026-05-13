"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { updateListingStatusAction } from "@/app/(main)/actions";
import type { MarketplaceListing } from "@/lib/marketplace";

const actionsByStatus: Record<
  MarketplaceListing["status"],
  Array<{
    action: "publish" | "archive" | "mark_sold" | "delete";
    label: string;
  }>
> = {
  Draft: [
    { action: "publish", label: "Publish" },
    { action: "delete", label: "Delete" },
  ],
  Active: [
    { action: "archive", label: "Archive" },
    { action: "mark_sold", label: "Mark sold" },
    { action: "delete", label: "Delete" },
  ],
  Expired: [
    { action: "publish", label: "Republish" },
    { action: "delete", label: "Delete" },
  ],
  Sold: [{ action: "delete", label: "Delete" }],
  Removed: [],
};

export function ListingStatusActions({
  listing,
  currentPath,
}: {
  listing: MarketplaceListing;
  currentPath: string;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const actions = actionsByStatus[listing.status];

  if (!actions.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        This listing is no longer editable from seller actions.
      </p>
    );
  }

  function handleAction(action: "publish" | "archive" | "mark_sold" | "delete") {
    setPendingAction(action);
    setMessage(null);

    startTransition(async () => {
      try {
        const updatedListing = await updateListingStatusAction(
          listing.id,
          action,
          currentPath
        );
        setMessage(`Listing moved to ${updatedListing.status.toLowerCase()}.`);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "We could not update this listing."
        );
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {actions.map((item) => (
          <button
            key={item.action}
            type="button"
            onClick={() => handleAction(item.action)}
            disabled={pendingAction !== null}
            className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === item.action ? "Updating..." : item.label}
          </button>
        ))}
      </div>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
