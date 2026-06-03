import Link from "next/link";
import {
  boostListingAction,
  deleteListingAction,
  walletTopUpAction,
} from "@/app/(main)/actions";
import { SellerRatingSummary } from "@/components/marketplace/seller-rating-summary";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchBoostPackages,
  fetchMyListingQuota,
  fetchMyListings,
  fetchMyTransactions,
  fetchMyWallet,
  fetchReceivedSellerRatings,
  fetchSellerRatingSummary,
} from "@/lib/marketplace-api";
import type {
  ApiSellerRating,
  ApiSellerPriorityTier,
  MarketplaceListing,
  MarketplaceTransaction,
  SessionUser,
} from "@/lib/marketplace";
import { humanizeBoostPlacement } from "@/lib/marketplace";

const walletActivityPreviewLimit = 3;

function formatPackagePrice(price: string | number, currency: string) {
  const amount = Number(price);

  return `${currency} ${Number.isNaN(amount) ? price : amount.toLocaleString()}`;
}

function formatWalletDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
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

function formatWalletLedgerType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAffordableBoostPackageCount({
  balance,
  boostPackages,
  currency,
}: {
  balance: string | number;
  boostPackages: Awaited<ReturnType<typeof fetchBoostPackages>>;
  currency: string;
}) {
  const walletBalance = Number(balance);

  if (!Number.isFinite(walletBalance)) {
    return 0;
  }

  return boostPackages.filter((boostPackage) => {
    const price = Number(boostPackage.price);

    return (
      boostPackage.currency === currency &&
      Number.isFinite(price) &&
      price <= walletBalance
    );
  }).length;
}

function isBoostPackageAvailableForListing(
  boostPackage: Awaited<ReturnType<typeof fetchBoostPackages>>[number],
  listing: MarketplaceListing,
) {
  const categoryIds =
    boostPackage.categories?.map((item) => item.categoryId) ?? [];

  if (categoryIds.length === 0) {
    return true;
  }

  return categoryIds.some(
    (categoryId) =>
      categoryId === listing.categoryId ||
      categoryId === listing.parentCategoryId,
  );
}

function getBoostPackageScopeLabel(
  boostPackage: Awaited<ReturnType<typeof fetchBoostPackages>>[number],
) {
  const categories = boostPackage.categories ?? [];

  if (categories.length === 0) {
    return "All categories";
  }

  const categoryNames = categories
    .map((item) => item.category?.name)
    .filter(Boolean);

  if (categoryNames.length <= 2) {
    return categoryNames.join(", ");
  }

  return `${categoryNames.slice(0, 2).join(", ")} +${categoryNames.length - 2}`;
}

function getBoostOptionSummaries({
  boostPackages,
  listings,
  wallet,
}: {
  boostPackages: Awaited<ReturnType<typeof fetchBoostPackages>>;
  listings: MarketplaceListing[];
  wallet: Awaited<ReturnType<typeof fetchMyWallet>>;
}) {
  const activeUnboostedListings = listings.filter(
    (listing) => listing.status === "Active" && !listing.isBoosted,
  );
  const walletBalance = Number(wallet.balance);

  return boostPackages.map((boostPackage) => {
    const price = Number(boostPackage.price);
    const eligibleListings = activeUnboostedListings.filter((listing) =>
      isBoostPackageAvailableForListing(boostPackage, listing),
    );
    const walletAffordable =
      boostPackage.currency === wallet.currency &&
      Number.isFinite(price) &&
      Number.isFinite(walletBalance) &&
      price <= walletBalance;

    return {
      boostPackage,
      eligibleListings,
      walletAffordable,
    };
  });
}

function getFreeListingBalanceDetail({
  freeListingAllowance,
  freeListingRemaining,
  freeListingUsed,
}: Awaited<ReturnType<typeof fetchMyListingQuota>>) {
  if (freeListingAllowance === 0) {
    return "No free listing allowance";
  }

  if (freeListingRemaining === 0) {
    return `${freeListingUsed} active/pending used`;
  }

  return `${freeListingUsed} active/pending used`;
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
        : undefined) ??
      (listing.paidPriorityEnabled ? "Manual priority" : "No listing fee"),
    createdLabel: transaction?.createdLabel,
    detail: transaction
      ? `${transaction.amountLabel} / ${transaction.statusLabel}`
      : listing.listingPaymentMode === "PAID"
        ? "Paid listing fallback created after free quota was used"
      : listing.paidPriorityEnabled
        ? "Admin-paid priority is enabled"
        : "Covered by free listing allowance",
    label: getListingPaymentLabel(status),
    status,
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
      const info = getListingPaymentInfo(listing, listingFeeTransactions);

      if (info.status === "SUCCEEDED" || info.status === "MANUAL_PAID") {
        summary.paid += 1;
      } else if (info.status === "PENDING") {
        summary.pending += 1;
      } else if (
        info.status === "FAILED" ||
        info.status === "CANCELLED" ||
        info.status === "REFUNDED"
      ) {
        summary.needsAttention += 1;
      } else {
        summary.included += 1;
      }

      return summary;
    },
    {
      included: 0,
      needsAttention: 0,
      paid: 0,
      pending: 0,
    },
  );
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
    case "HIDDEN":
      return "border-[rgba(217,93,57,0.24)] bg-[var(--brand-soft)] text-[var(--brand-strong)]";
    default:
      return "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]";
  }
}

function getReviewStatusCounts(reviews: ApiSellerRating[]) {
  return reviews.reduce(
    (counts, review) => {
      if (review.review) {
        const status = review.reviewStatus ?? "PENDING";
        counts[status] += 1;
      } else {
        counts.ratingOnly += 1;
      }

      return counts;
    },
    {
      APPROVED: 0,
      HIDDEN: 0,
      PENDING: 0,
      REJECTED: 0,
      ratingOnly: 0,
    },
  );
}

function getRatingDistribution(reviews: ApiSellerRating[]) {
  const distribution = new Map<number, number>();

  for (let stars = 1; stars <= 5; stars += 1) {
    distribution.set(stars, 0);
  }

  for (const review of reviews) {
    distribution.set(review.stars, (distribution.get(review.stars) ?? 0) + 1);
  }

  return [5, 4, 3, 2, 1].map((stars) => ({
    count: distribution.get(stars) ?? 0,
    stars,
  }));
}

function getSellerRatingInsight({
  ratingSummary,
  reviews,
}: {
  ratingSummary: Awaited<ReturnType<typeof fetchSellerRatingSummary>>;
  reviews: ApiSellerRating[];
}) {
  const pendingReviews = reviews.filter(
    (review) => review.review && review.reviewStatus === "PENDING",
  ).length;

  if (pendingReviews > 0) {
    return `${pendingReviews} written reviews are pending moderation.`;
  }

  if (!ratingSummary.ratingCount) {
    return "Ratings and written reviews will appear after customers submit feedback.";
  }

  if (
    ratingSummary.averageRating != null &&
    ratingSummary.averageRating >= 4.5
  ) {
    return "Strong customer feedback is helping your seller reputation.";
  }

  return "Keep responding quickly and closing clean transactions to improve seller trust.";
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
      return "Highest seller priority with premium placement signals.";
    case "VERIFIED":
      return "Admin-verified seller profile with stronger marketplace trust.";
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
    case "success":
      return "border-[rgba(31,122,95,0.28)] bg-[rgba(31,122,95,0.12)] text-[var(--success)]";
    case "accent":
      return "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]";
    case "brand":
      return "border-[rgba(217,93,57,0.24)] bg-[var(--brand-soft)] text-[var(--brand-strong)]";
    default:
      return "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]";
  }
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
  ratingSummary: Awaited<ReturnType<typeof fetchSellerRatingSummary>>;
  reviewCount: number;
  user: SessionUser;
}) {
  const badges: Array<{
    label: string;
    detail: string;
    tone: "accent" | "brand" | "success" | "muted";
  }> = [];

  if (user.sellerPriorityTier !== "NONE") {
    badges.push({
      label: humanizeSellerTier(user.sellerPriorityTier),
      detail: "Seller type",
      tone: user.sellerPriorityTier === "AUTHORIZED" ? "accent" : "success",
    });
  }

  if (user.emailVerified && user.phoneVerified) {
    badges.push({
      label: "Identity verified",
      detail: "Email and phone",
      tone: "success",
    });
  } else if (user.emailVerified || user.phoneVerified) {
    badges.push({
      label: "Basic verification",
      detail: user.emailVerified ? "Email verified" : "Phone verified",
      tone: "brand",
    });
  }

  if (
    ratingSummary.ratingCount >= 5 &&
    ratingSummary.averageRating != null &&
    ratingSummary.averageRating >= 4.5
  ) {
    badges.push({
      label: "Top rated",
      detail: `${ratingSummary.averageRating.toFixed(1)} average`,
      tone: "success",
    });
  } else if (ratingSummary.ratingCount > 0) {
    badges.push({
      label: "Customer rated",
      detail: `${ratingSummary.ratingCount} ratings`,
      tone: "brand",
    });
  }

  if (reviewCount > 0) {
    badges.push({
      label: "Customer reviewed",
      detail: `${reviewCount} written reviews`,
      tone: "brand",
    });
  }

  if (activeCount >= 5) {
    badges.push({
      label: "Active seller",
      detail: `${activeCount} active listings`,
      tone: "accent",
    });
  } else if (activeCount > 0) {
    badges.push({
      label: "Listed seller",
      detail: `${activeCount} active`,
      tone: "brand",
    });
  }

  if (boostedCount > 0) {
    badges.push({
      label: "Promoting listings",
      detail: `${boostedCount} boosted`,
      tone: "accent",
    });
  }

  if (user.avatarUrl && user.bio && user.location) {
    badges.push({
      label: "Profile complete",
      detail: "Photo, bio, location",
      tone: "success",
    });
  }

  return badges.length
    ? badges
    : [
        {
          label: "New seller",
          detail: "Build trust signals",
          tone: "muted" as const,
        },
      ];
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
  ratingSummary: Awaited<ReturnType<typeof fetchSellerRatingSummary>>;
  reviewCount: number;
  user: SessionUser;
}) {
  return [
    {
      label: "Email verified",
      complete: user.emailVerified,
      detail: user.emailVerified ? "Confirmed" : "Verify your email",
    },
    {
      label: "Phone verified",
      complete: user.phoneVerified,
      detail: user.phoneVerified ? "Confirmed" : "Add and verify a phone",
    },
    {
      label: "Public profile",
      complete: Boolean(user.avatarUrl && user.bio && user.location),
      detail:
        user.avatarUrl && user.bio && user.location
          ? "Photo, bio, and location ready"
          : "Add photo, bio, and location",
    },
    {
      label: "Active listings",
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
            ? `${boostedCount} boosted`
            : "Boost listings or earn a seller tier",
    },
  ];
}

function SellerProfileStatus({
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
  ratingSummary: Awaited<ReturnType<typeof fetchSellerRatingSummary>>;
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
          <h2 className="text-2xl font-black">{tierLabel}</h2>
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
            <p className="mt-1 text-2xl font-black">{completionPercent}%</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Reputation score</p>
            <p className="mt-1 text-2xl font-black">
              {ratingSummary.reputationScore}
            </p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Listings</p>
            <p className="mt-1 text-2xl font-black">{listingsCount}</p>
          </div>
        </div>
        <div className="mt-4">
          <Link href="/profile" className="action-secondary px-3 py-2 text-sm font-bold">
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

function SellerWalletBalance({
  boostPackages,
  wallet,
}: {
  boostPackages: Awaited<ReturnType<typeof fetchBoostPackages>>;
  wallet: Awaited<ReturnType<typeof fetchMyWallet>>;
}) {
  const recentLedger = wallet.ledger?.slice(0, walletActivityPreviewLimit) ?? [];
  const affordableBoostPackageCount = getAffordableBoostPackageCount({
    balance: wallet.balance,
    boostPackages,
    currency: wallet.currency,
  });

  return (
    <section className="panel grid gap-5 lg:grid-cols-[1fr_1.35fr] lg:items-start">
      <div>
        <p className="section-eyebrow">Seller wallet</p>
        <h2 className="mt-2 text-2xl font-black">Wallet balance</h2>
        <p className="mt-3 text-4xl font-black">
          {formatPackagePrice(wallet.balance, wallet.currency)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            Currency {wallet.currency}
          </span>
          <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            {affordableBoostPackageCount} boost packages affordable
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/transactions"
            className="action-secondary px-3 py-2 text-sm font-bold"
          >
            View payment history
          </Link>
          <Link href="/sell" className="action-primary px-3 py-2 text-sm font-black">
            Create listing
          </Link>
        </div>
        <form action={walletTopUpAction} className="mt-5 grid gap-2 sm:max-w-sm">
          <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
            Top-up amount
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <input
                name="amount"
                type="number"
                min="1"
                step="1"
                defaultValue="100"
                className="surface-input rounded-md px-3 py-2 text-sm font-bold"
              />
              <input
                name="currency"
                defaultValue={wallet.currency}
                maxLength={3}
                className="surface-input rounded-md px-3 py-2 text-sm font-bold uppercase"
              />
            </div>
          </label>
          <button className="action-primary px-3 py-2 text-sm font-black">
            Top up wallet
          </button>
        </form>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
            Wallet activity
          </p>
          <span className="text-xs font-bold text-[var(--muted)]">
            Latest {recentLedger.length}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {recentLedger.length ? (
            recentLedger.map((entry) => {
              const amount = Number(entry.amount);
              const isCredit = Number.isFinite(amount) && amount >= 0;

              return (
                <div
                  key={entry.id}
                  className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-black">
                      {formatWalletLedgerType(entry.type)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatWalletDate(entry.createdAt)} / Balance after{" "}
                      {formatPackagePrice(entry.balanceAfter, entry.currency)}
                    </p>
                  </div>
                  <p
                    className={`text-lg font-black ${
                      isCredit
                        ? "text-[var(--success)]"
                        : "text-[var(--brand-strong)]"
                    }`}
                  >
                    {isCredit ? "+" : ""}
                    {formatPackagePrice(entry.amount, entry.currency)}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm font-bold text-[var(--muted)]">
              No wallet activity yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SellerListingPaymentStatus({
  listingFeeTransactions,
  listings,
}: {
  listingFeeTransactions: Map<string, MarketplaceTransaction>;
  listings: MarketplaceListing[];
}) {
  const summary = getListingPaymentSummary(listings, listingFeeTransactions);
  const paidSpend = Array.from(listingFeeTransactions.values())
    .filter((transaction) => transaction.status === "SUCCEEDED")
    .reduce((total, transaction) => total + transaction.amountValue, 0);
  const previewListings = listings.slice(0, 5);

  return (
    <section className="panel grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Listing payment status</p>
          <h2 className="mt-2 text-2xl font-black">Payment overview</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Track listing-fee payments, included listings, and payments that
            need attention.
          </p>
        </div>
        <Link
          href="/transactions?type=LISTING_FEE"
          className="action-secondary px-3 py-2 text-sm font-bold"
        >
          View listing payments
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Paid", summary.paid],
          ["Included", summary.included],
          ["Pending", summary.pending],
          ["Needs attention", summary.needsAttention],
          ["Listing fee spend", `AED ${paidSpend.toLocaleString()}`],
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

      <div className="grid gap-2">
        {previewListings.length ? (
          previewListings.map((listing) => {
            const info = getListingPaymentInfo(listing, listingFeeTransactions);

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

function SellerRatingsAndReviews({
  ratingSummary,
  reviews,
}: {
  ratingSummary: Awaited<ReturnType<typeof fetchSellerRatingSummary>>;
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
              Written customer reviews will appear here after a customer
              submits feedback.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SellerBoostOptions({
  boostPackages,
  listings,
  wallet,
}: {
  boostPackages: Awaited<ReturnType<typeof fetchBoostPackages>>;
  listings: MarketplaceListing[];
  wallet: Awaited<ReturnType<typeof fetchMyWallet>>;
}) {
  const optionSummaries = getBoostOptionSummaries({
    boostPackages,
    listings,
    wallet,
  });
  const activeUnboostedCount = listings.filter(
    (listing) => listing.status === "Active" && !listing.isBoosted,
  ).length;
  const walletReadyCount = optionSummaries.filter(
    (option) =>
      option.walletAffordable && option.eligibleListings.length > 0,
  ).length;

  return (
    <section className="panel grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Boost options</p>
          <h2 className="mt-2 text-2xl font-black">Available boost packages</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Compare active packages against your eligible listings and wallet
            balance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            {activeUnboostedCount} eligible listings
          </span>
          <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            {walletReadyCount} wallet-ready
          </span>
        </div>
      </div>

      {optionSummaries.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {optionSummaries.map(
            ({ boostPackage, eligibleListings, walletAffordable }) => (
              <article
                key={boostPackage.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{boostPackage.name}</h3>
                    <p className="mt-1 text-sm font-bold text-[var(--muted)]">
                      {humanizeBoostPlacement(boostPackage.placement)}
                    </p>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-black uppercase tracking-wide ${
                      walletAffordable
                        ? "border-[rgba(31,122,95,0.28)] bg-[rgba(31,122,95,0.12)] text-[var(--success)]"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
                    }`}
                  >
                    {walletAffordable ? "Wallet ready" : "Gateway"}
                  </span>
                </div>
                {boostPackage.description ? (
                  <p className="mt-3 text-sm leading-5 text-[var(--muted)]">
                    {boostPackage.description}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-[var(--muted)]">Price</span>
                    <span className="font-black">
                      {formatPackagePrice(
                        boostPackage.price,
                        boostPackage.currency,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-[var(--muted)]">
                      Duration
                    </span>
                    <span className="font-black">
                      {boostPackage.durationDays} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-[var(--muted)]">
                      Eligible
                    </span>
                    <span className="font-black">
                      {eligibleListings.length} listings
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  {getBoostPackageScopeLabel(boostPackage)}
                </p>
                <Link
                  href="#seller-listings"
                  className="action-secondary mt-4 px-3 py-2 text-center text-sm font-bold"
                >
                  Boost listing
                </Link>
              </article>
            ),
          )}
        </div>
      ) : (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm font-bold text-[var(--muted)]">
          No boost packages are active right now.
        </div>
      )}
    </section>
  );
}

function getAvailablePackages(
  boostPackages: Awaited<ReturnType<typeof fetchBoostPackages>>,
  listing: Awaited<ReturnType<typeof fetchMyListings>>[number],
) {
  return boostPackages.filter((boostPackage) =>
    isBoostPackageAvailableForListing(boostPackage, listing),
  );
}

export default async function MyListingsPage() {
  const { accessToken, user } = await requireSessionContext("/my-listings");
  const [
    listings,
    boostPackages,
    wallet,
    listingQuota,
    ratingSummary,
    receivedRatings,
    listingFeeTransactions,
  ] = await Promise.all([
    fetchMyListings(accessToken),
    fetchBoostPackages(),
    fetchMyWallet(accessToken),
    fetchMyListingQuota(accessToken),
    fetchSellerRatingSummary(user.id),
    fetchReceivedSellerRatings(accessToken),
    fetchMyTransactions(accessToken, {
      take: 100,
      type: "LISTING_FEE",
    }),
  ]);
  const activeCount = listings.filter(
    (listing) => listing.status === "Active",
  ).length;
  const boostedCount = listings.filter((listing) => listing.isBoosted).length;
  const totalViews = listings.reduce(
    (sum, listing) => sum + listing.viewCountValue,
    0,
  );
  const totalSaves = listings.reduce(
    (sum, listing) => sum + listing.saveCount,
    0,
  );
  const totalInquiries = listings.reduce(
    (sum, listing) => sum + listing.chatCount,
    0,
  );
  const totalBoostedViews = listings.reduce(
    (sum, listing) => sum + listing.boostedViewCount,
    0,
  );
  const sellerConversionRate = totalViews
    ? Number(((totalInquiries / totalViews) * 100).toFixed(1))
    : 0;
  const latestListingFeeTransactions =
    getLatestListingFeeTransactions(listingFeeTransactions);

  return (
    <div className="page grid gap-6">
      <div className="panel-dark flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="section-eyebrow">Your selling activity</p>
          <h1 className="mt-2 text-3xl font-black text-white">My listings</h1>
          <p className="mt-2 text-[#d7d9ea]">
            Manage the items you post from this account and track moderation
            status.
          </p>
        </div>
        <Link
          href="/sell"
          className="rounded-md bg-white px-4 py-3 text-sm font-bold text-[var(--foreground)]"
        >
          Create listing
        </Link>
      </div>

      <SellerProfileStatus
        activeCount={activeCount}
        boostedCount={boostedCount}
        listingsCount={listings.length}
        ratingSummary={ratingSummary}
        receivedReviewCount={receivedRatings.length}
        user={user}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Views", totalViews.toLocaleString(), "Listing detail visits"],
          ["Saves", totalSaves.toLocaleString(), "Buyer shortlists"],
          ["Inquiries", totalInquiries.toLocaleString(), "Listing conversations"],
          ["Conversion", `${sellerConversionRate}%`, "Inquiries per view"],
          ["Boost views", totalBoostedViews.toLocaleString(), "Views while boosted"],
        ].map(([label, value, detail]) => (
          <div key={label} className="panel">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              {detail}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total", listings.length],
          ["Active", activeCount],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
        <div className="panel">
          <p className="text-sm text-[var(--muted)]">Free listings</p>
          <p className="mt-2 text-3xl font-black">
            {listingQuota.freeListingRemaining}/
            {listingQuota.freeListingAllowance}
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            {getFreeListingBalanceDetail(listingQuota)}
          </p>
        </div>
        <div className="panel">
          <p className="text-sm text-[var(--muted)]">Boosted</p>
          <p className="mt-2 text-3xl font-black">{boostedCount}</p>
        </div>
        <div className="panel">
          <p className="text-sm text-[var(--muted)]">Seller rating</p>
          <SellerRatingSummary
            averageRating={ratingSummary.averageRating}
            ratingCount={ratingSummary.ratingCount}
            reviewCount={ratingSummary.reviewCount}
            className="mt-2 text-lg font-black"
          />
        </div>
      </div>

      <SellerWalletBalance boostPackages={boostPackages} wallet={wallet} />

      <SellerBoostOptions
        boostPackages={boostPackages}
        listings={listings}
        wallet={wallet}
      />

      <SellerListingPaymentStatus
        listingFeeTransactions={latestListingFeeTransactions}
        listings={listings}
      />

      <SellerRatingsAndReviews
        ratingSummary={ratingSummary}
        reviews={receivedRatings}
      />

      <div id="seller-listings" className="grid gap-3">
        {listings.length ? (
          listings.map((listing) => {
            const paymentInfo = getListingPaymentInfo(
              listing,
              latestListingFeeTransactions,
            );

            return (
              <section
                key={listing.id}
                className="panel grid gap-4 md:grid-cols-[9rem_1fr_minmax(14rem,18rem)] md:items-center"
              >
                <div className="h-32 overflow-hidden rounded-md bg-[var(--surface-strong)]">
                  {listing.imageUrls[0] ? (
                    <img
                      src={listing.imageUrls[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{listing.title}</h2>
                    <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-2 py-1 text-xs font-bold">
                      {listing.status}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-black ${paymentInfo.tone}`}
                    >
                      {paymentInfo.label}
                    </span>
                    {listing.isBoosted ? (
                      <span className="rounded-md border border-[var(--accent-strong)] bg-[var(--accent-soft)] px-2 py-1 text-xs font-black text-[var(--accent-strong)]">
                        {listing.boostLabel ?? "Boosted"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {listing.priceLabel} / {listing.location}
                  </p>
                  <p className="mt-2 text-sm font-bold text-[var(--muted)]">
                    Listing payment: {paymentInfo.detail}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {[
                      ["Views", listing.viewCountValue.toLocaleString()],
                      ["Saves", listing.saveCount.toLocaleString()],
                      ["Inquiries", listing.chatCount.toLocaleString()],
                      ["Conversion", `${listing.conversionRate}%`],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                  {listing.isBoosted ? (
                    <p className="mt-2 text-sm font-bold text-[var(--success)]">
                      Boost active: {listing.boostLabel}
                      {listing.boostEndsLabel
                        ? ` / ${listing.boostEndsLabel}`
                        : ""}
                      <span className="block text-xs text-[var(--muted)]">
                        {listing.boostedViewCount.toLocaleString()} boosted
                        views / {listing.boostedInquiryCount.toLocaleString()}{" "}
                        boosted inquiries / {listing.boostConversionRate}%
                        boost conversion
                      </span>
                    </p>
                  ) : null}
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                    {listing.description}
                  </p>
                </div>
              <div className="grid gap-2">
                <Link
                  href={
                    listing.status === "Active"
                      ? `/listings/${listing.id}`
                      : `/listings/${listing.id}/edit`
                  }
                  className="action-secondary px-3 py-2 text-center text-sm font-bold"
                >
                  {listing.status === "Active" ? "View" : "Review"}
                </Link>
                <Link
                  href={`/listings/${listing.id}/edit`}
                  className="action-secondary px-3 py-2 text-center text-sm font-bold"
                >
                  Edit
                </Link>
                {paymentInfo.transaction?.status === "PENDING" ? (
                  <Link
                    href={`/listings/${listing.id}/checkout?transactionId=${paymentInfo.transaction.id}`}
                    className="action-primary px-3 py-2 text-center text-sm font-black"
                  >
                    Continue checkout
                  </Link>
                ) : null}
                {listing.status === "Active" && !listing.isBoosted ? (
                  (() => {
                    const availablePackages = getAvailablePackages(
                      boostPackages,
                      listing,
                    );

                    return availablePackages.length ? (
                      <form action={boostListingAction} className="grid gap-2">
                        <input
                          type="hidden"
                          name="listingId"
                          value={listing.id}
                        />
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          Pay with
                          <select
                            name="paymentMethod"
                            defaultValue="GATEWAY"
                            className="surface-input rounded-md px-3 py-2 text-sm font-bold"
                          >
                            <option value="GATEWAY">Gateway</option>
                            <option value="WALLET">
                              Wallet (
                              {formatPackagePrice(
                                wallet.balance,
                                wallet.currency,
                              )}
                              )
                            </option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          Boost package
                          <select
                            name="packageId"
                            defaultValue={availablePackages[0]?.id}
                            className="surface-input rounded-md px-3 py-2 text-sm font-bold"
                          >
                            {availablePackages.map((boostPackage) => (
                              <option
                                key={boostPackage.id}
                                value={boostPackage.id}
                              >
                                {boostPackage.name} /{" "}
                                {formatPackagePrice(
                                  boostPackage.price,
                                  boostPackage.currency,
                                )}{" "}
                                / {boostPackage.durationDays} days
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="action-primary px-3 py-2 text-sm font-black">
                          Boost listing
                        </button>
                      </form>
                    ) : (
                      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-bold text-[var(--muted)]">
                        No boost package for this category
                      </div>
                    );
                  })()
                ) : listing.isBoosted ? (
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-bold text-[var(--success)]">
                    Active boost
                    {listing.boostEndsLabel ? (
                      <span className="block text-xs text-[var(--muted)]">
                        {listing.boostEndsLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <form action={deleteListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700">
                    Delete
                  </button>
                </form>
              </div>
              </section>
            );
          })
        ) : (
          <div className="panel">
            <h2 className="text-xl font-black">No listings yet.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Create your first listing to start appearing in marketplace search
              after review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
