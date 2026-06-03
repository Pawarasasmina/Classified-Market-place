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

  return (
    <div className="page grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={previewHref("/search", customerPreview)}
          className="action-secondary px-3 py-2 text-sm font-bold"
        >
          Back to search
        </Link>
        <Link
          href={previewHref(
            `/search?category=${listing.categorySlug}`,
            customerPreview,
          )}
          className="text-sm font-bold text-[var(--brand-strong)]"
        >
          More in {listing.subcategory}
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white text-[#11182d] shadow-sm">
          <div className="relative h-[28rem] bg-[var(--surface-strong)]">
            <img
              src={media.src}
              alt={media.alt}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: media.overlay }}
            />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              {listing.isBoosted ? (
                <span className="rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-black text-white">
                  Featured
                </span>
              ) : null}
              <span className="rounded-md bg-[rgba(9,12,26,0.78)] px-3 py-2 text-xs font-black uppercase tracking-wide text-white">
                {listing.subcategory}
              </span>
              <span className="rounded-md bg-white px-3 py-2 text-xs font-black text-[var(--brand-strong)]">
                {listing.status}
              </span>
            </div>
          </div>
          <div className="grid gap-6 p-5">
            <div>
              <h1 className="mt-3 text-3xl font-bold text-[#11182d]">
                {listing.title}
              </h1>
              <p className="mt-3 text-3xl font-black text-[#11182d]">
                {listing.priceLabel}
              </p>
              <p className="mt-2 text-sm text-[#5b6478]">
                {listing.location} / {listing.postedLabel}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide text-[#5b6478]">
                <span>{listing.viewCount}</span>
                <span>{listing.saveCount.toLocaleString()} saves</span>
                <span>{listing.chatCount.toLocaleString()} inquiries</span>
                <span>{listing.conversionRate}% conversion</span>
              </div>
              {listing.isBoosted ? (
                <p className="mt-3 text-sm font-black text-[var(--accent)]">
                  Featured placement active
                  {listing.boostEndsLabel ? ` / ${listing.boostEndsLabel}` : ""}
                </p>
              ) : null}
              <p className="mt-5 leading-7 text-[#404a60]">
                {listing.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {listing.featureBullets.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-md border border-[#d8ddf0] bg-[#eef1ff] px-3 py-2 text-sm font-semibold text-[#283163]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {gallery.length > 1 ? (
              <div>
                <p className="text-sm font-bold text-[#11182d]">Photos</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {gallery.slice(0, 6).map((src, index) => (
                    <div
                      key={`${src}-${index}`}
                      className="h-28 overflow-hidden rounded-md bg-[var(--surface-strong)]"
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {Object.keys(listing.attributes).length ? (
              <div>
                <p className="text-sm font-bold text-[#11182d]">
                  Listing details
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.entries(listing.attributes).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-[#d8ddf0] bg-[#fbfcff] p-3"
                    >
                      <p className="text-xs font-semibold uppercase text-[#5b6478]">
                        {key}
                      </p>
                      <p className="mt-1 font-semibold text-[#11182d]">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="grid h-fit gap-4">
          <div className="panel">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[linear-gradient(135deg,#6668e8,#a36e1d)] text-lg font-black text-white">
                {(seller?.name ?? listing.sellerDisplayName ?? "S")
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("")}
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-[var(--accent)]">
                  Seller
                </p>
                <h2 className="text-lg font-black">
                  {seller?.name ??
                    listing.sellerDisplayName ??
                    "Marketplace seller"}
                </h2>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
              <p>
                {seller?.verified || listing.sellerVerified
                  ? "Verified seller"
                  : "Marketplace seller"}
              </p>
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
                />
              ) : null}
            </div>
            <div className="mt-5 grid gap-2">
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
            <div className="panel p-5">
              <p className="text-sm font-black uppercase tracking-wide text-[var(--brand-strong)]">
                Seller rating
              </p>
              <p className="mt-3 text-sm text-[var(--muted)]">
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
            <div className="panel p-5 text-sm text-[var(--muted)]">
              Customers can rate your seller profile from your active listings.
            </div>
          ) : null}

          <div className="panel-dark p-5">
            <p className="text-sm font-black uppercase tracking-wide text-[#d7d9ea]">
              Buyer confidence
            </p>
            <div className="mt-4 grid gap-3 text-sm text-[#d7d9ea]">
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

          <div className="panel p-5">
            <p className="text-sm font-black uppercase tracking-wide text-[var(--brand-strong)]">
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
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Related listings</h2>
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
