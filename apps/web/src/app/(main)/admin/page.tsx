import Link from "next/link";
import { redirect } from "next/navigation";
import {
  moderateListingAction,
  updateListingPriorityOverrideAction,
} from "@/app/(main)/actions";
import {
  hasAdminPermission,
  humanizeAdminRole,
  normalizeRole,
  type AdminPermission,
} from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminCategories,
  fetchAdminBoostPackages,
  fetchAdminActiveBoostedListings,
  fetchAdminAuditLogs,
  fetchActiveListingsReport,
  fetchBoostRevenueReport,
  fetchAdminListingReports,
  fetchAdminListings,
  fetchAdminMonitoringReport,
  fetchAdminPriorityRules,
  fetchAdminSellerReport,
  fetchAdminSellerReviews,
  fetchAdminTransactions,
  fetchAdminUsers,
  fetchCategoryIncomeReport,
  fetchPaidListingsReport,
  fetchPendingSellerApprovalsReport,
  fetchTopSellersReport,
  fetchWalletPaymentsReport,
  MarketplaceApiError,
} from "@/lib/marketplace-api";

function isAdminDataUnavailable(error: unknown) {
  return error instanceof MarketplaceApiError && error.status >= 500;
}

function getAdminDataUnavailableMessage(error: unknown) {
  if (error instanceof MarketplaceApiError && error.status === 503) {
    return error.message;
  }

  if (error instanceof MarketplaceApiError) {
    return `Admin data is temporarily unavailable because the marketplace API returned ${error.status}. Please retry after the API/database connection recovers.`;
  }

  return "Admin data is temporarily unavailable.";
}

function AdminDataUnavailable({ message }: { message: string }) {
  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Admin workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">Dashboard unavailable</h1>
          <p className="mt-2 max-w-3xl text-[var(--muted)]">{message}</p>
        </div>
        <Link
          href="/admin"
          className="action-primary px-4 py-2 text-sm font-semibold"
        >
          Retry
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          [
            "Database connection",
            "The API is reachable, but it cannot currently reach the configured database.",
          ],
          [
            "Admin data",
            "Reports, listing moderation, payments, users, and boost data are paused until the database responds.",
          ],
          [
            "Public pages",
            "Public catalog pages can still render fallback content while live data recovers.",
          ],
        ].map(([title, detail]) => (
          <div key={title} className="admin-dashboard-card">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
              {title}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {detail}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

const scopedDashboardLinks: Array<{
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  permission: AdminPermission;
}> = [
  {
    href: "/admin/categories",
    eyebrow: "Catalog",
    title: "Categories",
    description: "View category hierarchy and catalog settings.",
    permission: "CATEGORIES_READ",
  },
  {
    href: "/admin/boosts",
    eyebrow: "Promotions",
    title: "Active Boosts",
    description: "Inspect active boosted listings and expiry windows.",
    permission: "BOOSTS_READ",
  },
  {
    href: "/admin/boost-packages",
    eyebrow: "Revenue",
    title: "Boost Packages",
    description: "Manage boost prices, durations, and placements.",
    permission: "BOOSTS_WRITE",
  },
  {
    href: "/admin/priority-rules",
    eyebrow: "Ranking",
    title: "Priority Rules",
    description: "Tune ranking rules and manual listing priority.",
    permission: "LISTINGS_PRIORITY",
  },
  {
    href: "/admin/reviews",
    eyebrow: "Reviews",
    title: "Seller Reviews",
    description: "Inspect or moderate written seller reviews.",
    permission: "REVIEWS_READ",
  },
  {
    href: "/admin/listing-reports",
    eyebrow: "Reports",
    title: "Listing Reports",
    description: "Review submitted listing reports and internal notes.",
    permission: "REPORTS_READ",
  },
  {
    href: "/admin/reports",
    eyebrow: "Monitoring",
    title: "Operations Reports",
    description: "Review operational, revenue, seller, and listing reports.",
    permission: "REPORTS_READ",
  },
  {
    href: "/admin/transactions",
    eyebrow: "Payments",
    title: "Transaction Ledger",
    description: "Inspect payments, provider references, and statuses.",
    permission: "TRANSACTIONS_READ",
  },
  {
    href: "/admin/wallet",
    eyebrow: "Wallets",
    title: "Wallet Desk",
    description: "Inspect seller balances and manual wallet adjustments.",
    permission: "WALLETS_WRITE",
  },
  {
    href: "/admin/users",
    eyebrow: "Users",
    title: "Users",
    description: "Inspect users and seller trust signals.",
    permission: "USERS_READ",
  },
  {
    href: "/admin/audit-logs",
    eyebrow: "Security",
    title: "Audit Logs",
    description: "Review admin changes and failed state-changing requests.",
    permission: "AUDIT_LOGS_READ",
  },
  {
    href: "/messages",
    eyebrow: "Support",
    title: "Support Inbox",
    description: "Open buyer, seller, and admin conversations.",
    permission: "SUPPORT_READ",
  },
];

async function ScopedAdminDashboard({
  accessToken,
  role,
}: {
  accessToken: string;
  role: string;
}) {
  const canModerateListings = hasAdminPermission(role, "LISTINGS_MODERATE");
  const listings = canModerateListings
    ? await fetchAdminListings(accessToken, { take: 50 })
    : [];
  const reviewQueue = listings.filter((listing) => listing.status === "Pending");
  const allowedLinks = scopedDashboardLinks.filter((link) =>
    hasAdminPermission(role, link.permission),
  );

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Admin workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {humanizeAdminRole(role)}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Your workspace is scoped to the permissions assigned to this role.
          </p>
        </div>
        <Link
          href="/?view=customer"
          target="_blank"
          rel="noreferrer"
          className="action-primary px-4 py-2 text-sm font-semibold"
        >
          View customer view
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {allowedLinks.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="admin-dashboard-card"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
              {item.eyebrow}
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              {item.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {item.description}
            </p>
          </Link>
        ))}
      </section>

      {canModerateListings ? (
        <section id="moderation" className="scroll-mt-24 grid gap-4">
          <div className="panel">
            <h2 className="text-xl font-semibold">Moderation Queue</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pending listings appear first; when the queue is empty, latest
              listings are shown.
            </p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(reviewQueue.length ? reviewQueue : listings).map((listing) => (
                  <tr key={listing.id}>
                    <td>
                      <span className="font-semibold">{listing.title}</span>
                    </td>
                    <td>
                      <span className="admin-status-badge">
                        {listing.status}
                      </span>
                    </td>
                    <td>{listing.subcategory}</td>
                    <td>{listing.location}</td>
                    <td>{listing.priceLabel}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {(["ACTIVE", "REJECTED", "DELETED"] as const).map(
                          (status) => (
                            <form key={status} action={moderateListingAction}>
                              <input
                                type="hidden"
                                name="listingId"
                                value={listing.id}
                              />
                              <input type="hidden" name="status" value={status} />
                              <button className="admin-table-action">
                                {status === "ACTIVE"
                                  ? "Approve"
                                  : status === "REJECTED"
                                    ? "Reject"
                                    : "Delete"}
                              </button>
                            </form>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listings.length === 0 ? (
              <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                No listings are available for moderation.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default async function AdminPage() {
  const { accessToken, user } = await requireSessionContext("/admin");

  if (!hasAdminPermission(user.role, "ADMIN_DASHBOARD")) {
    redirect("/");
  }

  if (normalizeRole(user.role) !== "ADMIN") {
    return <ScopedAdminDashboard accessToken={accessToken} role={user.role} />;
  }

  let adminData: Awaited<ReturnType<typeof loadAdminDashboardData>>;

  try {
    adminData = await loadAdminDashboardData(accessToken);
  } catch (error) {
    if (isAdminDataUnavailable(error)) {
      return (
        <AdminDataUnavailable
          message={getAdminDataUnavailableMessage(error)}
        />
      );
    }

    throw error;
  }

  const [
    categories,
    listings,
    transactions,
    listingReports,
    boostPackages,
    activeBoosts,
    priorityRules,
    users,
    pendingReviews,
    monitoringReport,
    sellerReport,
    pendingSellerApprovals,
    activeListingsReport,
    paidListingsReport,
    walletPaymentsReport,
    boostRevenueReport,
    topSellersReport,
    categoryIncomeReport,
    auditLogs,
  ] = adminData;
  const reviewQueue = listings.filter(
    (listing) => listing.status === "Pending",
  );
  const activeCount = listings.filter(
    (listing) => listing.status === "Active",
  ).length;
  const rejectedCount = listings.filter(
    (listing) => listing.status === "Rejected",
  ).length;
  const deletedCount = listings.filter(
    (listing) => listing.status === "Deleted",
  ).length;
  const activeListings = listings.filter(
    (listing) => listing.status === "Active",
  );
  const recommendedRankedListings = [...activeListings].sort(
    (first, second) =>
      (second.priorityRanking?.score ?? 0) -
        (first.priorityRanking?.score ?? 0) ||
      first.title.localeCompare(second.title),
  );
  const dashboardLinks = [
    {
      href: "/admin/categories",
      eyebrow: "Catalog",
      title: "Category Management",
      description: "Create, edit, disable, and organize category levels.",
      metric: categories.length,
      metricLabel: "categories",
    },
    {
      href: "/admin/boost-packages",
      eyebrow: "Revenue",
      title: "Boost Packages",
      description: "Set seller boost prices, durations, and placements.",
      metric: boostPackages.filter((item) => item.isActive).length,
      metricLabel: "active",
    },
    {
      href: "/admin/boosts",
      eyebrow: "Promotions",
      title: "Active Boosts",
      description: "Track boosted listing status and expiry windows.",
      metric: activeBoosts.length,
      metricLabel: "live",
    },
    {
      href: "/admin/priority-rules",
      eyebrow: "Ranking",
      title: "Priority Rules",
      description: "Tune boost and trusted seller search priority.",
      metric: priorityRules.filter((item) => item.isActive).length,
      metricLabel: "active",
    },
    {
      href: "/admin/users",
      eyebrow: "Users",
      title: "Seller Priority",
      description: "Assign authorized, verified, and VIP seller tiers.",
      metric: users.filter(
        (item) => (item.sellerPriorityTier ?? "NONE") !== "NONE",
      ).length,
      metricLabel: "tiered",
    },
    {
      href: "/admin/reports/sellers",
      eyebrow: "Sellers",
      title: "Total Sellers Report",
      description: "Audit seller totals, active sellers, tiers, and performance.",
      metric: sellerReport.overview.totalSellers,
      metricLabel: "total",
    },
    {
      href: "/admin/reports/top-sellers",
      eyebrow: "Sellers",
      title: "Top Sellers Report",
      description: "Rank sellers by revenue, engagement, ratings, and risk.",
      metric: topSellersReport.overview.rankedSellers,
      metricLabel: "ranked",
    },
    {
      href: "/admin/reports/seller-approvals",
      eyebrow: "Approvals",
      title: "Pending Seller Approvals",
      description: "Review sellers waiting for an approved priority tier.",
      metric: pendingSellerApprovals.overview.pendingApprovals,
      metricLabel: "pending",
    },
    {
      href: "#moderation",
      eyebrow: "Moderation",
      title: "Listing Review",
      description: "Approve, reject, or remove marketplace listings.",
      metric: reviewQueue.length,
      metricLabel: "pending",
    },
    {
      href: "/messages",
      eyebrow: "Support",
      title: "Support Inbox",
      description: "Open buyer, seller, and admin conversations.",
      metric: listings.length,
      metricLabel: "listings",
    },
    {
      href: "/admin/reviews",
      eyebrow: "Reviews",
      title: "Seller Reviews",
      description: "Approve or reject written customer feedback.",
      metric: pendingReviews.length,
      metricLabel: "pending",
    },
    {
      href: "/admin/reports/active-listings",
      eyebrow: "Listings",
      title: "Active Listings Report",
      description: "Audit live inventory, boosts, engagement, and risk.",
      metric: activeListingsReport.overview.activeListings,
      metricLabel: "active",
    },
    {
      href: "/admin/reports/paid-listings",
      eyebrow: "Revenue",
      title: "Paid Listings Report",
      description: "Audit listing fees, payment status, priority, and returns.",
      metric: paidListingsReport.overview.paidListings,
      metricLabel: "paid",
    },
    {
      href: "/admin/reports/category-income",
      eyebrow: "Revenue",
      title: "Category-wise Income Report",
      description: "Break down listing fees and boost income by category.",
      metric: categoryIncomeReport.overview.categoriesRepresented,
      metricLabel: "categories",
    },
    {
      href: "/admin/reports/boost-revenue",
      eyebrow: "Revenue",
      title: "Boost Revenue Report",
      description: "Track boost payments, packages, placements, and returns.",
      metric: boostRevenueReport.overview.successfulPurchases,
      metricLabel: "paid",
    },
    {
      href: "/admin/wallet",
      eyebrow: "Wallets",
      title: "Wallet Desk",
      description: "Track balances, manual adjustments, top-ups, and spend.",
      metric: walletPaymentsReport.overview.fundedWallets,
      metricLabel: "funded",
    },
    {
      href: "/admin/reports",
      eyebrow: "Monitoring",
      title: "Operations Reports",
      description: "Track revenue, engagement, queues, and safety alerts.",
      metric: monitoringReport.overview.openReports,
      metricLabel: "open",
    },
    {
      href: "/admin/listing-reports",
      eyebrow: "Reports",
      title: "Listing Reports",
      description: "Review submitted listing reports and action unsafe ads.",
      metric: listingReports.length,
      metricLabel: "open",
    },
    {
      href: "/admin/transactions",
      eyebrow: "Payments",
      title: "Transaction Ledger",
      description:
        "Audit payment status, providers, refunds, and linked listings.",
      metric: transactions.length,
      metricLabel: "recent",
    },
    {
      href: "/admin/audit-logs",
      eyebrow: "Security",
      title: "Audit Logs",
      description: "Review admin changes, auth events, and failed writes.",
      metric: auditLogs.length,
      metricLabel: "recent",
    },
  ];

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Admin workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">Dashboard</h1>
          <p className="mt-2 text-[var(--muted)]">
            Manage the marketplace without switching through customer pages.
          </p>
        </div>
        <Link
          href="/?view=customer"
          target="_blank"
          rel="noreferrer"
          className="action-primary px-4 py-2 text-sm font-semibold"
        >
          View customer view
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Pending", reviewQueue.length],
          ["Active", activeCount],
          ["Rejected", rejectedCount],
          ["Deleted", deletedCount],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {dashboardLinks.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="admin-dashboard-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
                  {item.eyebrow}
                </p>
                <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {item.description}
                </p>
              </div>
              <span className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                {item.metric} {item.metricLabel}
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section id="ranking-preview" className="scroll-mt-24 grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Recommended Ranking Preview
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Computed customer priority scores and the active factors
              contributing to each listing position.
            </p>
          </div>
          <Link
            href="/admin/priority-rules"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Configure weights
          </Link>
        </div>
        <div className="grid gap-3">
          {recommendedRankedListings.map((listing, index) => (
            <div
              key={listing.id}
              className="panel flex flex-wrap items-start justify-between gap-4"
            >
              <div className="min-w-[14rem]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Rank {index + 1}
                </p>
                <p className="mt-1 font-semibold">{listing.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {listing.subcategory} / {listing.priceLabel}
                </p>
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {listing.priorityRanking?.factors.map((factor) => (
                  <span key={factor.key} className="search-chip">
                    {factor.label}: +{factor.score}
                    {factor.detail ? ` (${factor.detail})` : ""}
                  </span>
                ))}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Score
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {listing.priorityRanking?.score ?? 0}
                </p>
              </div>
            </div>
          ))}
          {recommendedRankedListings.length === 0 ? (
            <div className="panel text-sm text-[var(--muted)]">
              Active listings will appear here with their ranking factors.
            </div>
          ) : null}
        </div>
      </section>

      <section id="priority-overrides" className="scroll-mt-24 grid gap-4">
        <div className="panel">
          <h2 className="text-xl font-semibold">Manual Priority Overrides</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Promote a listing in Recommended results using the configured rule,
            mark it as paid premium, pin it above automated ranking, or set a
            final score with optional start and end times. Direct customer price
            and newest sorts remain field-first.
          </p>
        </div>
        <div className="grid gap-3">
          {activeListings.map((listing) => (
            <form
              key={listing.id}
              action={updateListingPriorityOverrideAction}
              className="panel grid gap-3 lg:grid-cols-[minmax(180px,1fr)_auto_auto_auto_130px_185px_185px_auto]"
            >
              <input type="hidden" name="listingId" value={listing.id} />
              <div>
                <p className="font-semibold">{listing.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {listing.subcategory} / {listing.priceLabel}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="paid"
                  type="checkbox"
                  value="true"
                  defaultChecked={listing.paidPriorityEnabled}
                />
                Paid
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="promoted"
                  type="checkbox"
                  value="true"
                  defaultChecked={listing.adminPriorityPromoted}
                />
                Promote
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="pinned"
                  type="checkbox"
                  value="true"
                  defaultChecked={listing.adminPriorityPinned}
                />
                Pin
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Score</span>
                <input
                  name="score"
                  type="number"
                  min="0"
                  max="1000000"
                  defaultValue={listing.adminPriorityScore ?? ""}
                  className="surface-input"
                  placeholder="Automatic"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">From</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={listing.adminPriorityStartsAt?.slice(0, 16)}
                  className="surface-input"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Until</span>
                <input
                  name="expiresAt"
                  type="datetime-local"
                  defaultValue={listing.adminPriorityExpiresAt?.slice(0, 16)}
                  className="surface-input"
                />
              </label>
              <button className="action-primary self-end px-4 py-2 text-sm font-semibold">
                Save priority
              </button>
            </form>
          ))}
          {activeListings.length === 0 ? (
            <div className="panel text-sm text-[var(--muted)]">
              Approve a listing before assigning a customer-result priority.
            </div>
          ) : null}
        </div>
      </section>

      <section id="moderation" className="scroll-mt-24 grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Moderation Queue</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pending listings appear first; when the queue is empty, the latest
              listings are shown.
            </p>
          </div>
          <Link
            href="/admin/categories"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Manage categories
          </Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Status</th>
                <th>Category</th>
                <th>Location</th>
                <th>Price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(reviewQueue.length ? reviewQueue : listings).map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <span className="font-semibold">{listing.title}</span>
                  </td>
                  <td>
                    <span className="admin-status-badge">{listing.status}</span>
                  </td>
                  <td>{listing.subcategory}</td>
                  <td>{listing.location}</td>
                  <td>{listing.priceLabel}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {(["ACTIVE", "REJECTED", "DELETED"] as const).map(
                        (status) => (
                          <form key={status} action={moderateListingAction}>
                            <input
                              type="hidden"
                              name="listingId"
                              value={listing.id}
                            />
                            <input type="hidden" name="status" value={status} />
                            <button className="admin-table-action">
                              {status === "ACTIVE"
                                ? "Approve"
                                : status === "REJECTED"
                                  ? "Reject"
                                  : "Delete"}
                            </button>
                          </form>
                        ),
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {listings.length === 0 ? (
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No listings are available for moderation.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function loadAdminDashboardData(accessToken: string) {
  return Promise.all([
    fetchAdminCategories(accessToken),
    fetchAdminListings(accessToken, { take: 50 }),
    fetchAdminTransactions(accessToken, { take: 50 }),
    fetchAdminListingReports(accessToken, { status: "OPEN", take: 50 }),
    fetchAdminBoostPackages(accessToken),
    fetchAdminActiveBoostedListings(accessToken),
    fetchAdminPriorityRules(accessToken),
    fetchAdminUsers(accessToken),
    fetchAdminSellerReviews(accessToken, { status: "PENDING" }),
    fetchAdminMonitoringReport(accessToken, { days: 30, topTake: 5 }),
    fetchAdminSellerReport(accessToken, { days: 30, take: 5 }),
    fetchPendingSellerApprovalsReport(accessToken, { days: 30, take: 5 }),
    fetchActiveListingsReport(accessToken, { days: 30, take: 5 }),
    fetchPaidListingsReport(accessToken, { days: 30, take: 5 }),
    fetchWalletPaymentsReport(accessToken, { days: 30, take: 5 }),
    fetchBoostRevenueReport(accessToken, { days: 30, take: 5 }),
    fetchTopSellersReport(accessToken, { days: 30, take: 5 }),
    fetchCategoryIncomeReport(accessToken, { days: 30, take: 5 }),
    fetchAdminAuditLogs(accessToken, { take: 20 }),
  ]);
}
