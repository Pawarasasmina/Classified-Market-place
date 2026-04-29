import { ListingCard } from "@/components/marketplace/listing-card";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchListings } from "@/lib/marketplace-api";

const fallbackSavedSearches = [
  "2BR apartment in Marina under AED 9k",
  "Toyota Camry 2020+ under AED 75k",
  "iPhone 15 Pro Max in Sharjah",
];

export default async function SavedPage() {
  await requireSessionContext("/saved");
  const savedListings = await fetchListings({ take: 6 });

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[0.68fr_0.32fr]">
        <div>
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Saved items
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
            Live listings ready for saved-state persistence.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            The backend does not expose favorites yet, so this screen now uses the
            authenticated session and live listings API instead of mock saved items.
            Once saved-item persistence lands, this same surface can swap from
            browse-ready inventory to the user&apos;s real bookmarks.
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
              {fallbackSavedSearches.map((savedSearch) => (
                <span
                  key={savedSearch}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]"
                >
                  {savedSearch}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Backend status
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Favorites and saved-search alerts are still missing backend routes.
              This page is now session-aware and API-backed, so it is ready for
              those endpoints when they are added.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
