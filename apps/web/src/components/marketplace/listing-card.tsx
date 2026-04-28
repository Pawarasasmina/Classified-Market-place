import Link from "next/link";
import { getSellerById, type Listing } from "@/lib/phase1-data";

export function ListingCard({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  const seller = getSellerById(listing.sellerId);

  return (
    <article className="card-shadow overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)]">
      <div
        className="h-44"
        style={{
          background: `linear-gradient(135deg, ${listing.imagePalette[0]}, ${listing.imagePalette[1]} 55%, ${listing.imagePalette[2]})`,
        }}
      />

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {listing.subcategory}
            </p>
            <h3
              className={`${compact ? "text-lg" : "text-xl"} mt-2 font-semibold text-[var(--foreground)]`}
            >
              {listing.title}
            </h3>
          </div>

          <span className="rounded-full bg-[rgba(31,107,90,0.1)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            {listing.status}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="display-font text-lg font-bold text-[var(--foreground)]">
            {listing.priceLabel}
          </p>
          <p className="text-sm text-[var(--muted)]">{listing.postedLabel}</p>
        </div>

        <p className="text-sm leading-6 text-[var(--muted)]">{listing.location}</p>

        <div className="flex flex-wrap gap-2">
          {listing.featureBullets.slice(0, compact ? 2 : 4).map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--muted)]"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-[var(--muted)]">
            {seller ? `${seller.name} • ${seller.responseRate} response rate` : ""}
          </div>
          <Link
            href={`/listings/${listing.id}`}
            className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--surface)]"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
