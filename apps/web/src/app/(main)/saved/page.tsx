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
    <div className="page">
      <div className="grid gap-8 xl:grid-cols-[0.68fr_0.32fr]">
        <div>
          <p className="section-eyebrow">Saved items</p>
          <h1 className="mt-3 text-3xl font-black text-[var(--foreground)]">
            A personal shortlist for listings worth revisiting.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Keep a focused view of the listings and searches you want to compare
            before reaching out to sellers.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {savedListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} compact />
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="panel">
            <p className="section-eyebrow">Saved searches</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {fallbackSavedSearches.map((savedSearch) => (
                <span
                  key={savedSearch}
                  className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]"
                >
                  {savedSearch}
                </span>
              ))}
            </div>
          </div>

          <div className="panel-dark p-6">
            <p className="section-eyebrow">Smart shortlist</p>
            <p className="mt-4 text-sm leading-7 text-[#d7d9ea]">
              Use saved searches to keep common buying missions close at hand,
              then move quickly into fresh matching inventory.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
