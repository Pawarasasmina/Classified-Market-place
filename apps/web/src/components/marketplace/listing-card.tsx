import Link from "next/link";
import { type MarketplaceListing } from "@/lib/marketplace";

export function ListingCard({
  listing,
}: {
  listing: MarketplaceListing;
  compact?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-md border border-[var(--line)] bg-white shadow-sm">
      <div className="h-40 bg-[#eef3f1]">
        {listing.imageUrls[0] ? (
          <img
            src={listing.imageUrls[0]}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            No photo
          </div>
        )}
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-[var(--muted)]">{listing.subcategory}</p>
            <h3 className="mt-1 font-semibold text-[var(--foreground)]">{listing.title}</h3>
          </div>
          <span className="rounded-md border border-[var(--line)] bg-[var(--brand-soft)] px-2 py-1 text-xs font-semibold text-[var(--brand-strong)]">
            {listing.status}
          </span>
        </div>
        <p className="font-bold text-[var(--foreground)]">{listing.priceLabel}</p>
        <p className="text-sm text-[var(--muted)]">{listing.location}</p>
        <Link
          href={`/listings/${listing.id}`}
          className="action-secondary px-3 py-2 text-center text-sm font-semibold hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
