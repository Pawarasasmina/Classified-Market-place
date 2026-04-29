import Image from "next/image";
import Link from "next/link";
import {
  getSellerById,
  type Listing as MockListing,
} from "@/lib/phase1-data";
import { type MarketplaceListing } from "@/lib/marketplace";
import { getListingMedia } from "@/lib/listing-media";

type ListingCardListing = MarketplaceListing | MockListing;

export function ListingCard({
  listing,
  compact = false,
}: {
  listing: ListingCardListing;
  compact?: boolean;
}) {
  const media = getListingMedia(listing);
  const fallbackSeller = getSellerById(listing.sellerId);
  const sellerName =
    "sellerDisplayName" in listing && listing.sellerDisplayName
      ? listing.sellerDisplayName
      : fallbackSeller?.name;
  const sellerMeta =
    "sellerVerified" in listing && listing.sellerVerified
      ? "verified seller"
      : fallbackSeller?.responseRate
        ? `${fallbackSeller.responseRate} response rate`
        : undefined;

  return (
    <article className="card-shadow overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)]">
      <div className="relative h-44 overflow-hidden">
        <Image
          src={media.src}
          alt={media.alt}
          fill
          unoptimized
          sizes={compact ? "(max-width: 1024px) 100vw, 33vw" : "100vw"}
          className="object-cover transition-transform duration-500 hover:scale-[1.03]"
        />
        <div
          className="absolute inset-0"
          style={{ background: media.overlay }}
        />
      </div>

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
            {sellerName ? `${sellerName}${sellerMeta ? ` - ${sellerMeta}` : ""}` : ""}
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
