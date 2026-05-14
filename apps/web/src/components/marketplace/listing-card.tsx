import Link from "next/link";
import { getListingMedia } from "@/lib/listing-media";
import { type MarketplaceListing } from "@/lib/marketplace";

export function ListingCard({
  listing,
  customerView = false,
}: {
  listing: MarketplaceListing;
  compact?: boolean;
  customerView?: boolean;
}) {
  const listingHref = `/listings/${listing.id}${customerView ? "?view=customer" : ""}`;
  const media = getListingMedia(listing);

  return (
    <article className="listing-card group">
      <div className="listing-card-media">
        <img
          src={media.src}
          alt={media.alt}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div
          className="absolute inset-0"
          style={{ background: media.overlay }}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="listing-chip uppercase tracking-[0.18em] text-white">
            {listing.subcategory}
          </span>
          <span className="listing-status-pill">
            {listing.status}
          </span>
        </div>
      </div>

      <div className="listing-card-body">
        <div>
          <h3 className="line-clamp-2 min-h-12 text-lg font-black leading-6 text-white">
            {listing.title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span>{listing.location}</span>
            <span>/</span>
            <span>{listing.postedLabel}</span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="text-xl font-black text-white">
            {listing.priceLabel}
          </p>
          <span className="listing-chip">
            {listing.condition}
          </span>
        </div>

        <div className="flex min-h-8 flex-wrap gap-2">
          {listing.featureBullets.slice(0, 3).map((feature) => (
            <span
              key={feature}
              className="listing-chip"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <p className="min-w-0 truncate text-sm text-[var(--muted)]">
            {listing.sellerDisplayName
              ? `${listing.sellerDisplayName}${listing.sellerVerified ? " / verified" : ""}`
              : "Marketplace seller"}
          </p>
          <Link
            href={listingHref}
            className="listing-details-button shrink-0"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
