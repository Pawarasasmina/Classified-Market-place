import { ListingCard } from "@/components/marketplace/listing-card";
import { SavedSearchCard } from "@/components/marketplace/saved-search-card";
import { requireSessionContext } from "@/lib/auth-dal";
import { SaveListingButton } from "@/components/marketplace/save-listing-button";
import { fetchSavedListings, fetchSavedSearches } from "@/lib/marketplace-api";

export default async function SavedPage() {
  const { accessToken } = await requireSessionContext("/saved");
  const [savedListings, savedSearches] = await Promise.all([
    fetchSavedListings(accessToken),
    fetchSavedSearches(accessToken),
  ]);

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[0.68fr_0.32fr]">
        <div>
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Saved items
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
            Your real saved listings, backed by the live API.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            This page now loads the signed-in user&apos;s actual saved listings from
            the backend. You can remove items here and keep your favorites synced
            across protected marketplace pages.
          </p>

          {savedListings.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {savedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  compact
                  action={
                    <SaveListingButton
                      listingId={listing.id}
                      initialSaved
                      currentPath="/saved"
                      variant="ghost"
                    />
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[2rem] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.76)] px-6 py-10 text-sm leading-7 text-[var(--muted)]">
              You have not saved any listings yet. Browse the marketplace and use the
              save action on listing pages to build your shortlist.
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Saved searches
            </p>
            <div className="mt-4 space-y-4">
              {savedSearches.length ? (
                savedSearches.map((savedSearch) => (
                  <SavedSearchCard
                    key={savedSearch.id}
                    savedSearch={savedSearch}
                    currentPath="/saved"
                  />
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm leading-7 text-[var(--muted)]">
                  Save a search from the search results page to keep its filters and
                  alert preference here.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Backend status
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Saved listings and saved searches are both persisted through real
              backend routes, including alert toggles for each saved search.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
