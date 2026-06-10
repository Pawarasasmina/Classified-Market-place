import Link from "next/link";
import { upgradeSellerPrivilegeAction } from "@/app/(main)/actions";
import { SellerRatingSummary } from "@/components/marketplace/seller-rating-summary";
import type {
  ApiSellerPriorityTier,
  ApiSellerPrivilegeTier,
  ApiSellerRating,
  ApiSellerRatingSummary,
  MarketplaceListing,
  MarketplaceTransaction,
  SessionUser,
} from "@/lib/marketplace";

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);

  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString() : value}`;
}

function formatReviewDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanizeSellerTier(tier: ApiSellerPriorityTier) {
  switch (tier) {
    case "VIP":
      return "VIP seller";
    case "VERIFIED":
      return "Verified seller";
    case "AUTHORIZED":
      return "Authorized seller";
    default:
      return "Standard seller";
  }
}

function getSellerTypeDescription(tier: ApiSellerPriorityTier) {
  switch (tier) {
    case "VIP":
      return "Admin-verified seller profile with stronger marketplace trust.";
    case "VERIFIED":
      return "Verified seller profile with stronger buyer confidence.";
    case "AUTHORIZED":
      return "Authorized seller profile with approved selling privileges.";
    default:
      return "Standard seller profile with normal marketplace placement.";
  }
}

function getSellerStatusTone(tier: ApiSellerPriorityTier) {
  if (tier === "VIP" || tier === "VERIFIED") {
    return "text-[var(--success)]";
  }

  if (tier === "AUTHORIZED") {
    return "text-[var(--accent-strong)]";
  }

  return "text-[var(--muted)]";
}

function getSellerBadgeTone(tone: "accent" | "brand" | "success" | "muted") {
  switch (tone) {
    case "accent":
      return "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]";
    case "brand":
      return "border-[rgba(217,93,57,0.24)] bg-[var(--brand-soft)] text-[var(--brand-strong)]";
    case "success":
      return "border-[rgba(31,122,95,0.28)] bg-[rgba(31,122,95,0.12)] text-[var(--success)]";
    default:
      return "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]";
  }
}

function getReviewStatusLabel(status: ApiSellerRating["reviewStatus"]) {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "PENDING":
      return "Pending";
    case "REJECTED":
      return "Rejected";
    case "HIDDEN":
      return "Hidden";
    default:
      return "Rating only";
  }
}

function getReviewStatusTone(status: ApiSellerRating["reviewStatus"]) {
  switch (status) {
    case "APPROVED":
      return "border-[rgba(31,122,95,0.28)] bg-[rgba(31,122,95,0.12)] text-[var(--success)]";
    case "PENDING":
      return "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]";
    case "REJECTED":
      return "border-[rgba(217,93,57,0.24)] bg-[var(--brand-soft)] text-[var(--brand-strong)]";
    case "HIDDEN":
      return "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]";
    default:
      return "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]";
  }
}

function getReviewStatusCounts(reviews: ApiSellerRating[]) {
  return reviews.reduce(
    (counts, review) => {
      if (!review.review) {
        counts.ratingOnly += 1;
        return counts;
      }

      if (review.reviewStatus === "APPROVED") {
        counts.APPROVED += 1;
      } else if (review.reviewStatus === "PENDING") {
        counts.PENDING += 1;
      } else if (review.reviewStatus === "REJECTED") {
        counts.REJECTED += 1;
      } else if (review.reviewStatus === "HIDDEN") {
        counts.HIDDEN += 1;
      }

      return counts;
    },
    { APPROVED: 0, PENDING: 0, REJECTED: 0, HIDDEN: 0, ratingOnly: 0 },
  );
}

function getRatingDistribution(reviews: ApiSellerRating[]) {
  const counts = new Map<number, number>();

  for (const review of reviews) {
    counts.set(review.stars, (counts.get(review.stars) ?? 0) + 1);
  }

  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: counts.get(stars) ?? 0,
  }));
}

function getSellerRatingInsight({
  ratingSummary,
  reviews,
}: {
  ratingSummary: ApiSellerRatingSummary;
  reviews: ApiSellerRating[];
}) {
  const pendingReviews = reviews.filter(
    (review) => review.review && review.reviewStatus === "PENDING",
  ).length;

  if (pendingReviews > 0) {
    return `${pendingReviews} written reviews are pending moderation.`;
  }

  if (ratingSummary.ratingCount === 0) {
    return "Ratings and written reviews will appear after customers submit feedback.";
  }

  return "Your latest customer feedback helps buyers judge trust and response quality.";
}

function buildSellerBadges({
  activeCount,
  boostedCount,
  ratingSummary,
  reviewCount,
  user,
}: {
  activeCount: number;
  boostedCount: number;
  ratingSummary: ApiSellerRatingSummary;
  reviewCount: number;
  user: SessionUser;
}) {
  const badges: Array<{
    detail: string;
    label: string;
    tone: "accent" | "brand" | "muted" | "success";
  }> = [];

  if (user.sellerPriorityTier !== "NONE") {
    badges.push({
      detail: humanizeSellerTier(user.sellerPriorityTier),
      label: "Priority tier",
      tone: "success",
    });
  }

  if (activeCount > 0) {
    badges.push({
      detail: `${activeCount} active`,
      label: "Live listings",
      tone: "accent",
    });
  }

  if (boostedCount > 0) {
    badges.push({
      detail: `${boostedCount} boosted`,
      label: "Boost running",
      tone: "brand",
    });
  }

  if (ratingSummary.ratingCount > 0) {
    badges.push({
      detail: `${ratingSummary.ratingCount} ratings`,
      label: "Rated seller",
      tone: "success",
    });
  }

  if (reviewCount > 0) {
    badges.push({
      detail: `${reviewCount} written reviews`,
      label: "Reviewed seller",
      tone: "muted",
    });
  }

  return badges;
}

function buildProfileStatusItems({
  activeCount,
  boostedCount,
  ratingSummary,
  reviewCount,
  user,
}: {
  activeCount: number;
  boostedCount: number;
  ratingSummary: ApiSellerRatingSummary;
  reviewCount: number;
  user: SessionUser;
}) {
  return [
    {
      label: "Seller profile",
      complete: user.sellerProfileStatus === "APPROVED",
      detail:
        user.sellerProfileStatus === "APPROVED"
          ? "Approved and visible for marketplace selling"
          : `Status: ${user.sellerProfileStatus ?? "Not started"}`,
    },
    {
      label: "Active inventory",
      complete: activeCount > 0,
      detail: activeCount ? `${activeCount} active` : "Publish a listing",
    },
    {
      label: "Customer feedback",
      complete: ratingSummary.ratingCount > 0,
      detail: ratingSummary.ratingCount
        ? `${ratingSummary.ratingCount} ratings / ${reviewCount} reviews`
        : "No ratings yet",
    },
    {
      label: "Promotion signal",
      complete: boostedCount > 0 || user.sellerPriorityTier !== "NONE",
      detail:
        user.sellerPriorityTier !== "NONE"
          ? humanizeSellerTier(user.sellerPriorityTier)
          : boostedCount
            ? `${boostedCount} boosted listings`
            : "Boost listings or earn a seller tier",
    },
  ];
}

function getListingPaymentTone(
  status: MarketplaceTransaction["status"] | "INCLUDED" | "MANUAL_PAID",
) {
  switch (status) {
    case "SUCCEEDED":
    case "MANUAL_PAID":
      return "border-[rgba(31,122,95,0.28)] bg-[rgba(31,122,95,0.12)] text-[var(--success)]";
    case "PENDING":
      return "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]";
    case "FAILED":
    case "CANCELLED":
    case "REFUNDED":
      return "border-[rgba(217,93,57,0.24)] bg-[var(--brand-soft)] text-[var(--brand-strong)]";
    default:
      return "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]";
  }
}

function getListingPaymentLabel(
  status: MarketplaceTransaction["status"] | "INCLUDED" | "MANUAL_PAID",
) {
  switch (status) {
    case "SUCCEEDED":
      return "Paid";
    case "PENDING":
      return "Payment pending";
    case "FAILED":
      return "Payment failed";
    case "CANCELLED":
      return "Payment cancelled";
    case "REFUNDED":
      return "Refunded";
    case "MANUAL_PAID":
      return "Paid priority";
    default:
      return "Included";
  }
}

function getLatestListingFeeTransactions(
  transactions: MarketplaceTransaction[],
) {
  const byListing = new Map<string, MarketplaceTransaction>();

  for (const transaction of transactions) {
    if (!transaction.listingId || byListing.has(transaction.listingId)) {
      continue;
    }

    byListing.set(transaction.listingId, transaction);
  }

  return byListing;
}

function getListingPaymentInfo(
  listing: MarketplaceListing,
  listingFeeTransactions: Map<string, MarketplaceTransaction>,
) {
  const transaction = listingFeeTransactions.get(listing.id);
  const status = transaction
    ? transaction.status
    : listing.listingPaymentMode === "PAID"
      ? "PENDING"
      : listing.paidPriorityEnabled
        ? "MANUAL_PAID"
        : "INCLUDED";

  return {
    amountLabel:
      transaction?.amountLabel ??
      (listing.listingPaymentMode === "PAID"
        ? "Listing fee required"
        : listing.paidPriorityEnabled
          ? "Manual paid priority"
          : "Included with quota"),
    createdLabel: transaction?.createdLabel ?? null,
    detail:
      transaction?.typeLabel ??
      (listing.listingPaymentMode === "PAID"
        ? "Listing fee payment"
        : listing.paidPriorityEnabled
          ? "Manual paid priority listing"
          : "Included in seller allowance"),
    label: getListingPaymentLabel(status),
    tone: getListingPaymentTone(status),
    transaction,
  };
}

function getListingPaymentSummary(
  listings: MarketplaceListing[],
  listingFeeTransactions: Map<string, MarketplaceTransaction>,
) {
  return listings.reduce(
    (summary, listing) => {
      const transaction = listingFeeTransactions.get(listing.id);

      if (transaction?.status === "SUCCEEDED" || listing.paidPriorityEnabled) {
        summary.paid += 1;
      } else if (transaction?.status === "PENDING") {
        summary.pending += 1;
      } else if (
        transaction?.status === "FAILED" ||
        transaction?.status === "CANCELLED" ||
        transaction?.status === "REFUNDED" ||
        listing.listingPaymentMode === "PAID"
      ) {
        summary.needsAttention += 1;
      } else {
        summary.included += 1;
      }

      return summary;
    },
    { included: 0, needsAttention: 0, paid: 0, pending: 0 },
  );
}

export function SellerProfileStatusPanel({
  activeCount,
  boostedCount,
  listingsCount,
  ratingSummary,
  receivedReviewCount,
  user,
}: {
  activeCount: number;
  boostedCount: number;
  listingsCount: number;
  ratingSummary: ApiSellerRatingSummary;
  receivedReviewCount: number;
  user: SessionUser;
}) {
  const statusItems = buildProfileStatusItems({
    activeCount,
    boostedCount,
    ratingSummary,
    reviewCount: receivedReviewCount,
    user,
  });
  const completedCount = statusItems.filter((item) => item.complete).length;
  const completionPercent = Math.round(
    (completedCount / statusItems.length) * 100,
  );
  const tierLabel = humanizeSellerTier(user.sellerPriorityTier);
  const priorityActive = user.sellerPriorityTier !== "NONE";
  const sellerBadges = buildSellerBadges({
    activeCount,
    boostedCount,
    ratingSummary,
    reviewCount: receivedReviewCount,
    user,
  });
  const statusMessage = priorityActive
    ? `${tierLabel} priority is active for your marketplace profile.`
    : "Your seller profile is live as a standard seller.";

  return (
    <section className="panel grid gap-5 lg:grid-cols-[1.05fr_1.65fr] lg:items-start">
      <div>
        <p className="section-eyebrow">Seller profile status</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold">{tierLabel}</h2>
          <span
            className={`rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1 text-xs font-black uppercase tracking-wide ${getSellerStatusTone(
              user.sellerPriorityTier,
            )}`}
          >
            {priorityActive ? "Priority active" : "Standard"}
          </span>
        </div>
        <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
          Seller type: {tierLabel}
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {statusMessage} {getSellerTypeDescription(user.sellerPriorityTier)}
        </p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[var(--muted)]">Profile readiness</p>
            <p className="mt-1 text-2xl font-bold">{completionPercent}%</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Reputation score</p>
            <p className="mt-1 text-2xl font-bold">
              {ratingSummary.reputationScore}
            </p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Listings</p>
            <p className="mt-1 text-2xl font-bold">{listingsCount}</p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href="/profile"
            className="action-secondary px-3 py-2 text-sm font-bold"
          >
            Update profile
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
              Seller badges
            </p>
            <span className="text-xs font-bold text-[var(--muted)]">
              {sellerBadges.length} active
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sellerBadges.map((badge) => (
              <span
                key={`${badge.label}-${badge.detail}`}
                className={`rounded-md border px-3 py-2 text-xs font-black ${getSellerBadgeTone(
                  badge.tone,
                )}`}
                title={badge.detail}
              >
                {badge.label}
                <span className="ml-2 font-bold opacity-75">
                  {badge.detail}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {statusItems.map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-black">{item.label}</p>
                <span
                  className={`rounded-md px-2 py-1 text-[0.65rem] font-black uppercase tracking-wide ${
                    item.complete
                      ? "bg-[rgba(31,122,95,0.12)] text-[var(--success)]"
                      : "bg-[var(--surface)] text-[var(--muted)]"
                  }`}
                >
                  {item.complete ? "Done" : "Todo"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SellerTierUpgradesPanel({
  currentTierName,
  returnTo,
  upgradeOptions,
}: {
  currentTierName: string;
  returnTo: string;
  upgradeOptions: ApiSellerPrivilegeTier[];
}) {
  if (upgradeOptions.length === 0) {
    return null;
  }

  return (
    <section className="panel grid gap-4">
      <div>
        <p className="section-eyebrow">Seller tier upgrades</p>
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Upgrade your seller privileges
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Move to a higher seller tier using your wallet balance. Your current
          tier is {currentTierName}.
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {upgradeOptions.map((tier) => (
          <form
            key={tier.id}
            action={upgradeSellerPrivilegeAction}
            className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <input
              type="hidden"
              name="sellerPrivilegeTierId"
              value={tier.id}
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {tier.code}
                </p>
                <h3 className="mt-1 text-base font-semibold">{tier.name}</h3>
              </div>
              <span className="text-sm font-semibold">
                {formatMoney(tier.sellerLevelUpgradeFee, tier.currency)}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {tier.description ?? "Higher seller visibility and quota limits."}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between gap-3">
                <span>Free listings</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {tier.monthlyFreeListingLimit}/month
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Active limit</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {tier.activeListingLimit ?? "Flexible"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Pending limit</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {tier.pendingListingLimit ?? "Flexible"}
                </span>
              </div>
            </div>
            <button className="action-primary mt-4 px-4 py-2.5 text-sm font-semibold">
              Upgrade to {tier.name}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

export function SellerRatingsAndReviewsPanel({
  ratingSummary,
  reviews,
}: {
  ratingSummary: ApiSellerRatingSummary;
  reviews: ApiSellerRating[];
}) {
  const writtenReviews = reviews.filter((review) => review.review);
  const latestWrittenReviews = [...writtenReviews]
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() -
        new Date(first.updatedAt).getTime(),
    )
    .slice(0, 4);
  const statusCounts = getReviewStatusCounts(reviews);
  const distribution = getRatingDistribution(reviews);
  const highestDistributionCount = Math.max(
    1,
    ...distribution.map((item) => item.count),
  );
  const reviewStatusPills: Array<{
    count: number;
    label: string;
    status: ApiSellerRating["reviewStatus"];
  }> = [
    { count: statusCounts.APPROVED, label: "Approved", status: "APPROVED" },
    { count: statusCounts.PENDING, label: "Pending", status: "PENDING" },
    { count: statusCounts.REJECTED, label: "Rejected", status: "REJECTED" },
    { count: statusCounts.HIDDEN, label: "Hidden", status: "HIDDEN" },
    { count: statusCounts.ratingOnly, label: "Rating only", status: undefined },
  ];

  return (
    <section className="panel grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Ratings and reviews</p>
          <h2 className="mt-2 text-2xl font-black">Customer feedback</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {getSellerRatingInsight({ ratingSummary, reviews })}
          </p>
        </div>
        <SellerRatingSummary
          averageRating={ratingSummary.averageRating}
          ratingCount={ratingSummary.ratingCount}
          reviewCount={ratingSummary.reviewCount}
          className="text-lg font-black"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [
            "Average rating",
            ratingSummary.averageRating != null
              ? ratingSummary.averageRating.toFixed(1)
              : "New",
          ],
          ["Ratings", ratingSummary.ratingCount],
          ["Written reviews", ratingSummary.reviewCount],
          ["Reputation", ratingSummary.reputationScore],
          ["Pending review", statusCounts.PENDING],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3"
          >
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4">
          <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
            Rating distribution
          </p>
          <div className="mt-4 grid gap-3">
            {distribution.map((item) => (
              <div
                key={item.stars}
                className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm"
              >
                <span className="font-bold text-[var(--muted)]">
                  {item.stars} stars
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)]"
                    style={{
                      width: `${(item.count / highestDistributionCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-right font-black">{item.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {reviewStatusPills.map((item) => (
              <span
                key={item.label}
                className={`rounded-md border px-2 py-1 text-xs font-black ${getReviewStatusTone(
                  item.status,
                )}`}
              >
                {item.label}: {item.count}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
              Latest written reviews
            </p>
            <span className="text-xs font-bold text-[var(--muted)]">
              {latestWrittenReviews.length} shown
            </span>
          </div>
          {latestWrittenReviews.length ? (
            latestWrittenReviews.map((review) => (
              <article
                key={review.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black">
                    {review.rater?.displayName ?? "Customer"} / {review.stars}{" "}
                    out of 5
                  </p>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-black ${getReviewStatusTone(
                      review.reviewStatus,
                    )}`}
                  >
                    {getReviewStatusLabel(review.reviewStatus)}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  {formatReviewDate(review.updatedAt)}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                  {review.review}
                </p>
                {review.listing ? (
                  <Link
                    href={`/listings/${review.listing.id}`}
                    className="mt-3 inline-block text-xs font-bold text-[var(--brand-strong)]"
                  >
                    Review for {review.listing.title}
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm font-bold text-[var(--muted)]">
              Written customer reviews will appear here after a customer submits
              feedback.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ListingPaymentStatusPanel({
  ctaHref = "/transactions?type=LISTING_FEE",
  ctaLabel = "View listing payments",
  listingFeeTransactions,
  listings,
}: {
  ctaHref?: string;
  ctaLabel?: string;
  listingFeeTransactions: MarketplaceTransaction[];
  listings: MarketplaceListing[];
}) {
  const latestListingFeeTransactions = getLatestListingFeeTransactions(
    listingFeeTransactions,
  );
  const summary = getListingPaymentSummary(
    listings,
    latestListingFeeTransactions,
  );
  const paidSpend = Array.from(latestListingFeeTransactions.values())
    .filter((transaction) => transaction.status === "SUCCEEDED")
    .reduce((total, transaction) => total + transaction.amountValue, 0);
  const previewListings = listings.slice(0, 5);

  return (
    <section className="panel grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Listing payment status</p>
          <h2 className="mt-2 text-2xl font-bold">Payment overview</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Track listing-fee payments, included listings, and payments that
            need attention.
          </p>
        </div>
        <Link href={ctaHref} className="action-secondary px-3 py-2 text-sm font-bold">
          {ctaLabel}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Paid", summary.paid],
          ["Included", summary.included],
          ["Pending", summary.pending],
          ["Needs attention", summary.needsAttention],
          ["Listing fee spend", paidSpend.toLocaleString()],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3"
          >
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        {previewListings.length ? (
          previewListings.map((listing) => {
            const info = getListingPaymentInfo(
              listing,
              latestListingFeeTransactions,
            );

            return (
              <div
                key={listing.id}
                className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="font-black">{listing.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {info.detail}
                    {info.createdLabel ? ` / ${info.createdLabel}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-md border px-3 py-2 text-xs font-black uppercase tracking-wide ${info.tone}`}
                >
                  {info.label}
                </span>
              </div>
            );
          })
        ) : (
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm font-bold text-[var(--muted)]">
            Listing payment status will appear after you create a listing.
          </div>
        )}
      </div>
    </section>
  );
}
