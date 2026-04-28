import { ListingCard } from "@/components/marketplace/listing-card";
import { getSavedListings, savedSearches } from "@/lib/phase1-data";

export default function SavedPage() {
  const savedListings = getSavedListings();

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[0.68fr_0.32fr]">
        <div>
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Saved items
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
            Favorites and saved-search placeholders for the MVP journey.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Sprint 4 in the delivery plan calls for favourites, saved items,
            and my listings. This page brings those bookmarks into a working
            browse flow alongside saved search reminders planned for alerts.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {savedListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} compact />
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Saved searches
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {savedSearches.map((savedSearch) => (
                <span
                  key={savedSearch.id}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]"
                >
                  {savedSearch.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Next delivery step
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Push, email, and event-based saved search alerts are planned for
              later delivery. The UI is present now so the Phase 1 navigation
              and user habits can form early.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
