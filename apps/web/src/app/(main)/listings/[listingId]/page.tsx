import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createListingReportAction,
  toggleSavedListingAction,
} from "@/app/(main)/actions";
import { ListingCard } from "@/components/marketplace/listing-card";
import { SellerRatingForm } from "@/components/marketplace/seller-rating-form";
import { SellerRatingSummary } from "@/components/marketplace/seller-rating-summary";
import { SellerReviews } from "@/components/marketplace/seller-reviews";
import { hasAnyAdminPermission } from "@/lib/admin-permissions";
import { getSessionContext } from "@/lib/auth-dal";
import { getListingMedia } from "@/lib/listing-media";
import {
  fetchListing,
  fetchListings,
  fetchMySavedListings,
  fetchMySellerRating,
  recordListingView,
  fetchSellerProfile,
  fetchSellerReviews,
} from "@/lib/marketplace-api";

type ListingDetailPageProps = {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{
    message?: string;
    report?: string;
    rating?: string;
    view?: string;
  }>;
};

function previewHref(path: string, customerPreview: boolean) {
  if (!customerPreview) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}view=customer`;
}

function sellerInitials(name: string | undefined | null) {
  return (name ?? "Marketplace seller")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function DetailIcon({
  name,
  className = "",
}: {
  name:
    | "arrow"
    | "camera"
    | "chat"
    | "chevron"
    | "eye"
    | "heart"
    | "location"
    | "shield"
    | "spark"
    | "tag";
  className?: string;
}) {
  const paths = {
    arrow: (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 5 13 3H8L6.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
        <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </>
    ),
    chat: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </>
    ),
    chevron: (
      <path d="m9 18 6-6-6-6" />
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </>
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    ),
    spark: (
      <>
        <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8Z" />
        <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z" />
      </>
    ),
    tag: (
      <>
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
        <path d="M7.5 7.5h.01" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

export default async function ListingDetailPage(props: ListingDetailPageProps) {
  const [{ listingId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const customerPreview = searchParams.view === "customer";
  const [listing, session] = await Promise.all([
    fetchListing(listingId),
    getSessionContext(),
  ]);

  if (!listing) {
    notFound();
  }

  const [seller, sellerReviews, relatedListings] = await Promise.all([
    fetchSellerProfile(listing.sellerId),
    fetchSellerReviews(listing.sellerId),
    fetchListings({
      categorySlug: listing.categorySlug || undefined,
      take: 4,
    }),
  ]);
  const media = getListingMedia(listing);
  const related = relatedListings
    .filter((item) => item.id !== listing.id)
    .slice(0, 3);
  const gallery = listing.imageUrls.length ? listing.imageUrls : [media.src];
  const reportState = searchParams.report;
  const reportMessage =
    reportState === "submitted"
      ? "Report submitted for admin review."
      : reportState === "error"
        ? (searchParams.message ?? "Could not submit this report.")
        : null;
  const isOwner = session?.user.id === listing.sellerId;
  const isAdmin = hasAnyAdminPermission(session?.user.role);
  const savedListings =
    session && !isOwner
      ? await fetchMySavedListings(session.accessToken).catch(() => [])
      : [];
  const isSaved = savedListings.some((item) => item.id === listing.id);

  if (!customerPreview && !isOwner && !isAdmin) {
    await recordListingView(listing.id).catch(() => null);
  }

  const canRate =
    Boolean(session) &&
    !isOwner &&
    !hasAnyAdminPermission(session?.user.role) &&
    (listing.status === "Active" || listing.status === "Sold");
  const myRating =
    canRate && session
      ? await fetchMySellerRating(session.accessToken, listing.id)
      : null;
  const ratingReturnTo = previewHref(
    `/listings/${listing.id}`,
    customerPreview,
  );
  const sellerName =
    seller?.name ?? listing.sellerDisplayName ?? "Marketplace seller";
  const verifiedListing = seller?.verified || listing.sellerVerified;
  const listingStats = [
    {
      label: "Views",
      value: listing.viewCount,
      icon: "eye" as const,
    },
    {
      label: "Saves",
      value: listing.saveCount.toLocaleString(),
      icon: "heart" as const,
    },
    {
      label: "Inquiries",
      value: listing.chatCount.toLocaleString(),
      icon: "chat" as const,
    },
  ];
  const overviewItems = [
    ["Condition", listing.condition],
    ["Status", listing.status],
    ["Category", listing.subcategory],
    ["Posted", listing.postedLabel],
    ["Location", listing.location],
    ["Conversion", `${listing.conversionRate}%`],
  ];

  return (
    <div className="listing-detail-page page grid gap-6">
      <div className="listing-detail-topbar">
        <Link
          href={previewHref("/search", customerPreview)}
          className="listing-detail-back-link"
        >
          <DetailIcon name="arrow" className="h-4 w-4" />
          <span>Back To Search</span>
        </Link>
        <nav className="listing-detail-breadcrumb" aria-label="Listing breadcrumb">
          <Link href={previewHref("/search", customerPreview)}>Marketplace</Link>
          <DetailIcon name="chevron" className="h-3.5 w-3.5" />
          <Link
            href={previewHref(
              `/search?category=${listing.categorySlug}`,
              customerPreview,
            )}
          >
            {listing.subcategory}
          </Link>
          <DetailIcon name="chevron" className="h-3.5 w-3.5" />
          <span>{listing.title}</span>
        </nav>
      </div>

      <section className="listing-detail-gallery-hero" aria-label="Listing photos">
        <div className="listing-detail-gallery-primary">
          <img
            src={gallery[0] ?? media.src}
            alt={media.alt}
            className="h-full w-full object-cover"
          />
          <div className="listing-detail-gallery-badge">
            <DetailIcon name="shield" className="h-4 w-4" />
            <span>
              {verifiedListing
                ? "Verified by Classified Marketplace"
                : listing.status}
            </span>
          </div>
        </div>
        <div className="listing-detail-gallery-side">
          {[gallery[1] ?? gallery[0] ?? media.src, gallery[2] ?? gallery[0] ?? media.src].map(
            (src, index) => (
              <div key={`${src}-${index}`} className="listing-detail-gallery-side-item">
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {index === 1 ? (
                  <Link
                    href={previewHref(
                      `/listings/${listing.id}/photos`,
                      customerPreview,
                    )}
                    className="listing-detail-photo-count"
                  >
                    <DetailIcon name="camera" className="h-4 w-4" />
                    <span>{gallery.length} photos</span>
                  </Link>
                ) : null}
              </div>
            ),
          )}
        </div>
      </section>

      <section className="listing-detail-layout">
        <article className="listing-detail-main-card">
          <div className="listing-detail-content">
            <div className="listing-detail-hero-copy">
              <div className="listing-detail-title-block">
                <div className="listing-detail-price-row">
                  <p className="listing-detail-price">{listing.priceLabel}</p>
                  <div className="listing-detail-summary-actions">
                    {session && !isOwner ? (
                      <form action={toggleSavedListingAction}>
                        <input type="hidden" name="listingId" value={listing.id} />
                        <input
                          type="hidden"
                          name="intent"
                          value={isSaved ? "unsave" : "save"}
                        />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={ratingReturnTo}
                        />
                        <button
                          className={`listing-detail-favorite-button ${
                            isSaved ? "listing-detail-favorite-button-active" : ""
                          }`}
                        >
                          <DetailIcon name="heart" className="h-5 w-5" />
                          <span>{isSaved ? "Favorited" : "Favorite"}</span>
                        </button>
                      </form>
                    ) : !session ? (
                      <Link
                        href={`/login?next=${encodeURIComponent(ratingReturnTo)}`}
                        className="listing-detail-favorite-button"
                      >
                        <DetailIcon name="heart" className="h-5 w-5" />
                        <span>Favorite</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
                <h1 className="listing-detail-title">{listing.title}</h1>
                <p className="listing-detail-location">
                  <DetailIcon name="location" className="h-4 w-4" />
                  <span>{listing.location}</span>
                  <span>/</span>
                  <span>{listing.postedLabel}</span>
                </p>
              </div>
              <div className="listing-detail-meta-row">
                <span>
                  <DetailIcon name="tag" className="h-4 w-4" />
                  {listing.subcategory}
                </span>
                <span>{listing.status}</span>
                {listing.isBoosted ? <span>Featured</span> : null}
              </div>
              {listing.isBoosted ? (
                <p className="listing-detail-boost-note">
                  <DetailIcon name="spark" className="h-4 w-4" />
                  Featured placement active
                  {listing.boostEndsLabel ? ` / ${listing.boostEndsLabel}` : ""}
                </p>
              ) : null}
              <p className="listing-detail-description">
                {listing.description}
              </p>

              {listing.featureBullets.length ? (
                <div className="listing-detail-features">
                  {listing.featureBullets.map((feature) => (
                    <span
                      key={feature}
                      className="listing-detail-feature"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <section className="listing-detail-section">
              <div className="listing-detail-section-head">
                <p className="listing-detail-section-label">Overview</p>
                <span>Listing snapshot</span>
              </div>
              <div className="listing-detail-overview">
                {overviewItems.map(([label, value]) => (
                  <div key={label} className="listing-detail-overview-item">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="listing-detail-section">
              <div className="listing-detail-section-head">
                <p className="listing-detail-section-label">Activity</p>
                <span>Live marketplace interest</span>
              </div>
              <div className="listing-detail-stats" aria-label="Listing activity">
                {listingStats.map((stat) => (
                  <div key={stat.label} className="listing-detail-stat">
                    <DetailIcon name={stat.icon} className="h-4 w-4" />
                    <span>
                      <strong>{stat.value}</strong>
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {Object.keys(listing.attributes).length ? (
              <section className="listing-detail-section">
                <div className="listing-detail-section-head">
                  <p className="listing-detail-section-label">Details</p>
                  <span>{Object.keys(listing.attributes).length} fields</span>
                </div>
                <div className="listing-detail-attributes">
                  {Object.entries(listing.attributes).map(([key, value]) => (
                    <div
                      key={key}
                      className="listing-detail-attribute"
                    >
                      <p>
                        {key}
                      </p>
                      <strong>
                        {String(value)}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </article>

        <aside className="listing-detail-sidebar">
          <div className="listing-detail-seller-card">
            <div className="listing-detail-seller-head">
              <div className="listing-detail-seller-avatar">
                {sellerInitials(sellerName)}
              </div>
              <div className="min-w-0">
                <p>
                  Seller
                </p>
                <h2>
                  {sellerName}
                </h2>
              </div>
            </div>
            <div className="listing-detail-seller-facts">
              <p className="listing-detail-trust-line">
                <DetailIcon name="shield" className="h-4 w-4" />
                {seller?.verified || listing.sellerVerified
                  ? "Verified seller"
                  : "Marketplace seller"}
              </p>
              {seller?.badges.length ? (
                <div className="listing-detail-seller-badges">
                  {seller.badges.map((badge) => (
                    <span
                      key={badge.id}
                      className="listing-detail-seller-badge"
                      style={{
                        background:
                          badge.badgeType.backgroundColor ?? "rgba(238,241,255,1)",
                        color: badge.badgeType.textColor ?? "#283163",
                      }}
                    >
                      {badge.badgeType.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <p>
                {seller?.joinedLabel ??
                  listing.sellerJoinedLabel ??
                  "Joined recently"}
              </p>
              <p>
                {seller?.totalListings ?? listing.sellerTotalListings ?? 0}{" "}
                active listings
              </p>
              {seller ? (
                <SellerRatingSummary
                  averageRating={seller.averageRating}
                  ratingCount={seller.ratingCount}
                  reviewCount={seller.reviewCount}
                  className="listing-detail-rating-summary"
                />
              ) : null}
            </div>
            <div className="listing-detail-actions">
              <Link
                href={previewHref(
                  `/messages?listing=${listing.id}`,
                  customerPreview,
                )}
                className="action-primary px-4 py-3 text-center text-sm font-bold"
              >
                Chat with seller
              </Link>
              {session && !isOwner ? (
                <form action={toggleSavedListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <input
                    type="hidden"
                    name="intent"
                    value={isSaved ? "unsave" : "save"}
                  />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={ratingReturnTo}
                  />
                  <button className="w-full action-secondary px-4 py-3 text-center text-sm font-bold">
                    {isSaved ? "Remove from saved" : "Save listing"}
                  </button>
                </form>
              ) : !session ? (
                <Link
                  href={`/login?next=${encodeURIComponent(ratingReturnTo)}`}
                  className="action-secondary px-4 py-3 text-center text-sm font-bold"
                >
                  Sign in to save
                </Link>
              ) : null}
            </div>
          </div>

          {!session ? (
            <div className="listing-detail-side-panel">
              <p className="listing-detail-panel-kicker">
                Seller rating
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Sign in to rate this seller after viewing their listing.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(ratingReturnTo)}`}
                className="mt-4 block action-secondary px-4 py-3 text-center text-sm font-bold"
              >
                Sign in to rate
              </Link>
            </div>
          ) : canRate ? (
            <SellerRatingForm
              listingId={listing.id}
              returnTo={ratingReturnTo}
              existingStars={myRating?.stars}
              existingReview={myRating?.review}
              result={searchParams.rating}
              message={searchParams.message}
            />
          ) : isOwner ? (
            <div className="listing-detail-side-panel text-sm text-[var(--muted)]">
              Customers can rate your seller profile from your active listings.
            </div>
          ) : null}

          <div className="listing-detail-confidence-panel">
            <p>
              Buyer confidence
            </p>
            <div>
              <p>
                Review the photos, seller verification, and listing details
                before meeting.
              </p>
              <p>
                Use in-app messages to keep the conversation attached to this
                listing.
              </p>
            </div>
          </div>

          <div className="listing-detail-side-panel">
            <p className="listing-detail-panel-kicker">
              Listing safety
            </p>
            <h2 className="mt-2 text-lg font-black">Report this listing</h2>
            {reportMessage ? (
              <p
                className={`mt-3 rounded-md border px-3 py-2 text-sm ${
                  reportState === "submitted"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {reportMessage}
              </p>
            ) : null}
            {!session ? (
              <div className="mt-4 grid gap-3 text-sm text-[var(--muted)]">
                <p>
                  Sign in to report suspicious, unsafe, or misleading listings.
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`}
                  className="action-secondary px-4 py-3 text-center text-sm font-bold"
                >
                  Sign in to report
                </Link>
              </div>
            ) : isOwner ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                You cannot report your own listing. Use My Listings to edit or
                remove it.
              </p>
            ) : (
              <form
                action={createListingReportAction}
                className="mt-4 grid gap-3"
              >
                <input type="hidden" name="listingId" value={listing.id} />
                <label className="grid gap-2 text-sm font-bold">
                  Reason
                  <select name="reason" className="surface-input">
                    <option value="Misleading listing">
                      Misleading listing
                    </option>
                    <option value="Suspicious seller">Suspicious seller</option>
                    <option value="Prohibited item">Prohibited item</option>
                    <option value="Duplicate listing">Duplicate listing</option>
                    <option value="Other safety concern">
                      Other safety concern
                    </option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Details
                  <textarea
                    name="details"
                    rows={4}
                    className="surface-input"
                    placeholder="Add context for the moderation team"
                  />
                </label>
                <button className="action-secondary px-4 py-3 text-sm font-black">
                  Submit report
                </button>
              </form>
            )}
          </div>
        </aside>
      </section>

      <SellerReviews
        reviews={sellerReviews.slice(0, 3)}
        title="Recent reviews for this seller"
      />

      {related.length ? (
        <section className="listing-detail-related">
          <div className="listing-detail-section-head">
            <p className="listing-detail-section-label">Related listings</p>
            <span>More from this category</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                compact
                customerView={customerPreview}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
