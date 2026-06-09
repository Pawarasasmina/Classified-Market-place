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
  const sellerRatingLabel =
    listing.sellerRatingCount && listing.sellerAverageRating != null
      ? `${listing.sellerAverageRating.toFixed(1)} / 5 (${listing.sellerRatingCount} ratings, ${listing.sellerReviewCount ?? 0} reviews)`
      : `No seller ratings yet (${listing.sellerReviewCount ?? 0} reviews)`;

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
          {listing.isBoosted ? (
            <span className="listing-featured-badge">
              {listing.boostLabel ?? "Boosted"}
            </span>
          ) : null}
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
          <h3 className="line-clamp-2 min-h-11 text-[1.15rem] font-black leading-6 text-white">
            {listing.title}
          </h3>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.92rem] text-[var(--muted)]">
            <span>{listing.location}</span>
            <span>/</span>
            <span>{listing.postedLabel}</span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="text-[1.05rem] font-black text-white">
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

        <div className="grid grid-cols-3 gap-2 text-[0.76rem] font-bold text-[var(--muted)]">
          <span>{listing.viewCount}</span>
          <span>{listing.chatCount.toLocaleString()} inquiries</span>
          <span>{listing.saveCount.toLocaleString()} saves</span>
        </div>

        <div className="listing-card-footer border-t border-[var(--line)] pt-3">
          <div className="min-w-0 text-sm">
            <span className="block truncate text-[var(--muted)]">
              {listing.sellerDisplayName
                ? `${listing.sellerDisplayName}${listing.sellerVerified ? " / verified" : ""}`
                : "Marketplace seller"}
            </span>
            {listing.sellerBadges.length ? (
              <span className="mt-1 block truncate text-xs font-bold text-[var(--foreground)]">
                {listing.sellerBadges
                  .slice(0, 2)
                  .map((badge) => badge.badgeType.label)
                  .join(" / ")}
              </span>
            ) : null}
            <span className="mt-1 block truncate text-xs font-bold text-[var(--accent-strong)]">
              Seller rating: {sellerRatingLabel}
            </span>
          </div>
          <Link
            href={listingHref}
            className="listing-details-button listing-details-button-compact"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
