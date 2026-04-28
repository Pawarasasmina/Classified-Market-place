import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/marketplace/listing-card";
import {
  getListingById,
  getRelatedListings,
  getSellerById,
} from "@/lib/phase1-data";

type ListingDetailPageProps = {
  params: Promise<{ listingId: string }>;
};

export default async function ListingDetailPage(
  props: ListingDetailPageProps
) {
  const { listingId } = await props.params;
  const listing = getListingById(listingId);

  if (!listing) {
    notFound();
  }

  const seller = getSellerById(listing.sellerId);
  const related = getRelatedListings(listing);

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[0.7fr_0.3fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)]">
            <div
              className="h-72"
              style={{
                background: `linear-gradient(135deg, ${listing.imagePalette[0]}, ${listing.imagePalette[1]} 50%, ${listing.imagePalette[2]})`,
              }}
            />

            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                    {listing.subcategory}
                  </p>
                  <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
                    {listing.title}
                  </h1>
                </div>
                <span className="rounded-full bg-[rgba(31,107,90,0.1)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
                  {listing.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
                <span>{listing.location}</span>
                <span>{listing.postedLabel}</span>
                <span>{listing.viewCount}</span>
                <span>{listing.chatCount} open chats</span>
              </div>

              <div className="rounded-[1.75rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] p-5">
                <p className="display-font text-2xl font-bold text-[var(--foreground)]">
                  {listing.priceLabel}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.featureBullets.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--muted)]"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.75rem] border border-[var(--line)] bg-white p-5">
                  <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                    Description
                  </p>
                  <p className="mt-4 text-base leading-8 text-[var(--muted)]">
                    {listing.description}
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-[var(--line)] bg-white p-5">
                  <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                    Attributes
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {Object.entries(listing.attributes).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3"
                      >
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          {key}
                        </p>
                        <p className="mt-2 font-semibold text-[var(--foreground)]">
                          {String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  Related listings
                </p>
                <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                  Same-category inventory to support discovery and conversion.
                </h2>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {related.map((item) => (
                <ListingCard key={item.id} listing={item} compact />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Seller widget
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d95d39,#1f6b5a)] font-bold text-white">
                {seller?.avatar}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  {seller?.name}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {seller?.verified ? "Verified seller" : "Private seller"}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <p>{seller?.responseRate} response rate</p>
              <p>{seller?.joinedLabel}</p>
              <p>{seller?.totalListings} active listings</p>
              <p>{seller?.location}</p>
            </div>

            <div className="mt-6 grid gap-3">
              <Link
                href={`/messages?listing=${listing.id}`}
                className="rounded-full bg-[var(--foreground)] px-5 py-3 text-center text-sm font-semibold text-[var(--surface)]"
              >
                Chat now
              </Link>
              <button
                type="button"
                className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
              >
                Make offer
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Phase 1 actions
            </p>
            <div className="mt-4 grid gap-3">
              {[
                "Share to WhatsApp",
                "Share to Telegram",
                "Copy listing link",
                "Report listing",
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
