"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import {
  saveListingAction,
  unsaveListingAction,
} from "@/app/(main)/actions";

export function SaveListingButton({
  listingId,
  initialSaved,
  currentPath,
  variant = "default",
}: {
  listingId: string;
  initialSaved: boolean;
  currentPath: string;
  variant?: "default" | "ghost";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = saved
          ? await unsaveListingAction(listingId, currentPath)
          : await saveListingAction(listingId, currentPath);

        setSaved(response.saved);
        setMessage(response.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "We could not update saved items.");
      } finally {
        setPending(false);
      }
    });
  }

  const buttonClassName =
    variant === "ghost"
      ? "rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
      : "rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-70`}
      >
        {pending ? "Updating..." : saved ? "Unsave listing" : "Save listing"}
      </button>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
