import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  moderateListingAction,
  updateListingPriorityOverrideAction,
} from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
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

function AdminModuleIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, ReactNode> = {
    approvals: (
      <>
        <path d="M12 3 3.8 18.2A1.8 1.8 0 0 0 5.4 21h13.2a1.8 1.8 0 0 0 1.6-2.8Z" />
        <path d="M12 8.5v5" />
        <path d="M12 17h.01" />
      </>
    ),
    catalog: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h4l2 2H18a2 2 0 0 1 2 2v9.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5Z" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </>
    ),
    promotions: (
      <>
        <path d="M4 13V8.5A2.5 2.5 0 0 1 6.5 6H9l8-3v16l-8-3H6.5A2.5 2.5 0 0 1 4 13.5Z" />
        <path d="M9 16v4" />
        <path d="M18 9h2" />
        <path d="m18.5 5.5 1.5-1.5" />
        <path d="m18.5 12.5 1.5 1.5" />
      </>
    ),
    ranking: (
      <>
        <path d="M4 19h16" />
        <path d="M7 16v-4" />
        <path d="M12 16V7" />
        <path d="M17 16v-7" />
        <path d="m15 7 2-2 2 2" />
      </>
    ),
    reports: (
      <>
        <path d="M5 19V5" />
        <path d="M5 19h15" />
        <path d="M9 15v-4" />
        <path d="M13 15V8" />
        <path d="M17 15v-2" />
      </>
    ),
    support: (
      <>
        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4.6A2.5 2.5 0 0 1 5 12.5Z" />
        <path d="M8.5 8.5h7" />
        <path d="M8.5 11.5H13" />
      </>
    ),
    users: (
      <>
        <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M17 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M14.5 17.5A4.5 4.5 0 0 1 21 20" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" />
        <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
        <path d="M7 8h8" />
      </>
    ),
    default: (
      <>
        <path d="M5 5h14v14H5Z" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
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
      {paths[name] ?? paths.default}
    </svg>
  );
}

function adminModuleIconName(eyebrow: string) {
  const key = eyebrow.toLowerCase();

  if (["revenue", "wallets", "payments"].includes(key)) return "wallet";
  if (["promotions"].includes(key)) return "promotions";
  if (["reports", "monitoring", "listings"].includes(key)) return "reports";
  if (["users", "sellers", "reviews"].includes(key)) return "users";
  if (["approvals", "moderation", "security"].includes(key)) return "approvals";
  if (["ranking"].includes(key)) return "ranking";
  if (["support"].includes(key)) return "support";
  if (["catalog"].includes(key)) return "catalog";

  return "default";
}

function AdminDataUnavailable({ message }: { message: string }) {
  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Admin workspace"
        title="Dashboard unavailable"
        description={message}
        badge="Data paused"
        actions={
          <Link
            href="/admin"
            className="action-primary px-4 py-2 text-sm font-semibold"
          >
            Retry
          </Link>
        }
      />

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
  searchParams,
}: {
  accessToken: string;
  role: string;
  searchParams: Awaited<AdminPageProps["searchParams"]>;
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
      <AdminPageHeader
        eyebrow="Admin workspace"
        title={humanizeAdminRole(role)}
        description="Your workspace is scoped to the permissions assigned to this role."
        badge={`${allowedLinks.length} modules`}
      />

      <AdminActionFeedback
        status={searchParams.moderation}
        message={searchParams.message}
        messages={{
          updated: "Listing moderation updated.",
          invalid: "Choose a listing and status before submitting.",
        }}
        successStatuses={["updated"]}
      />

      <section className="admin-card-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {allowedLinks.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="admin-dashboard-card admin-action-card"
          >
            <div className="admin-card-body">
              <div className="admin-card-head">
                <span className="admin-card-icon">
                  <AdminModuleIcon
                    name={adminModuleIconName(item.eyebrow)}
                    className="admin-card-icon-svg"
                  />
                </span>
                <div>
                  <p className="admin-card-eyebrow">{item.eyebrow}</p>
                  <h2 className="admin-card-title">{item.title}</h2>
                </div>
              </div>
              <p className="admin-card-copy">{item.description}</p>
            </div>
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
          <AdminTableEnhancer
            tableId="admin-scoped-moderation-table"
            copyLabel="listing IDs"
            stickyActions
          />
          <div className="admin-table-wrap">
            <table id="admin-scoped-moderation-table" className="admin-table">
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
                  <tr key={listing.id} data-row-id={listing.id}>
                    <td data-label="Listing">
                      <span className="font-semibold">{listing.title}</span>
                    </td>
                    <td data-label="Status">
                      <span
                        className="admin-status-badge"
                        data-status={listing.status.toLowerCase()}
                      >
                        {listing.status}
                      </span>
                    </td>
                    <td data-label="Category">{listing.subcategory}</td>
                    <td data-label="Location">{listing.location}</td>
                    <td data-label="Price">{listing.priceLabel}</td>
                    <td data-label="Actions">
                      <div className="admin-row-actions">
                        {(["ACTIVE", "REJECTED", "DELETED"] as const).map(
                          (status) => (
                            <form key={status} action={moderateListingAction}>
                              <input
                                type="hidden"
                                name="listingId"
                                value={listing.id}
                              />
                              <input type="hidden" name="status" value={status} />
                              <input type="hidden" name="returnTo" value="/admin" />
                              <AdminSubmitButton
                                className="admin-table-action"
                                confirmMessage={`${
                                  status === "ACTIVE"
                                    ? "Approve"
                                    : status === "REJECTED"
                                      ? "Reject"
                                      : "Delete"
                                } "${listing.title}"? This changes the listing status for customers and the seller.`}
                                pendingText="Updating..."
                              >
                                {status === "ACTIVE"
                                  ? "Approve"
                                  : status === "REJECTED"
                                    ? "Reject"
                                    : "Delete"}
                              </AdminSubmitButton>
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
              <div className="admin-empty-state">
                <p className="admin-empty-state-title">No listings found</p>
                <p className="admin-empty-state-copy">
                  New seller submissions and recent listings will appear here for moderation.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type AdminPageProps = {
  searchParams: Promise<{
    message?: string;
    moderation?: string;
    priority?: string;
  }>;
};

export default async function AdminPage(props: AdminPageProps) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext("/admin");

  if (!hasAdminPermission(user.role, "ADMIN_DASHBOARD")) {
    redirect("/");
  }

  if (normalizeRole(user.role) !== "ADMIN") {
    return (
      <ScopedAdminDashboard
        accessToken={accessToken}
        role={user.role}
        searchParams={searchParams}
      />
    );
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
      attention: pendingSellerApprovals.overview.pendingApprovals > 0,
    },
    {
      href: "#moderation",
      eyebrow: "Moderation",
      title: "Listing Review",
      description: "Approve, reject, or remove marketplace listings.",
      metric: reviewQueue.length,
      metricLabel: "pending",
      attention: reviewQueue.length > 0,
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
      attention: pendingReviews.length > 0,
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
      attention: monitoringReport.overview.openReports > 0,
    },
    {
      href: "/admin/listing-reports",
      eyebrow: "Reports",
      title: "Listing Reports",
      description: "Review submitted listing reports and action unsafe ads.",
      metric: listingReports.length,
      metricLabel: "open",
      attention: listingReports.length > 0,
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
      <AdminPageHeader
        eyebrow="Admin workspace"
        title="Dashboard"
        description="Manage the marketplace without switching through customer pages."
        badge={`${reviewQueue.length} pending reviews`}
      />

      <AdminActionFeedback
        status={searchParams.priority ?? searchParams.moderation}
        message={searchParams.message}
        messages={{
          updated: searchParams.priority
            ? "Priority override updated."
            : "Listing moderation updated.",
          invalid: searchParams.priority
            ? "Check the priority override fields and try again."
            : "Choose a listing and status before submitting.",
        }}
        successStatuses={["updated"]}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pending", value: reviewQueue.length, tone: "attention" },
          { label: "Active", value: activeCount, tone: "success" },
          { label: "Rejected", value: rejectedCount, tone: "danger" },
          { label: "Deleted", value: deletedCount, tone: "neutral" },
        ].map((item) => (
          <div
            key={item.label}
            className={`admin-stat-card admin-kpi-card admin-kpi-card-${item.tone}`}
          >
            <p className="admin-kpi-label">
              <span className="admin-kpi-status-dot" />
              {item.label}
            </p>
            <p className="admin-kpi-value">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="admin-card-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {dashboardLinks.map((item) => {
          const attention = "attention" in item && item.attention;

          return (
            <Link
              key={item.title}
              href={item.href}
              className={`admin-dashboard-card admin-action-card ${
                attention ? "admin-attention-card" : ""
              }`}
            >
              <div className="admin-card-body">
                <div>
                  <div className="admin-card-head">
                    <span className="admin-card-icon">
                      <AdminModuleIcon
                        name={adminModuleIconName(item.eyebrow)}
                        className="admin-card-icon-svg"
                      />
                    </span>
                    <div>
                      <p className="admin-card-eyebrow">{item.eyebrow}</p>
                      <h2 className="admin-card-title">{item.title}</h2>
                    </div>
                  </div>
                  <p className="admin-card-copy">{item.description}</p>
                </div>
                <span
                  className={`admin-card-metric ${
                    attention ? "admin-card-metric-attention" : ""
                  }`}
                >
                  {item.metric} {item.metricLabel}
                </span>
              </div>
            </Link>
          );
        })}
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
              <AdminSubmitButton
                className="action-primary self-end px-4 py-2 text-sm font-semibold"
                pendingText="Saving priority..."
              >
                Save priority
              </AdminSubmitButton>
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
        <AdminTableEnhancer
          tableId="admin-dashboard-moderation-table"
          copyLabel="listing IDs"
          stickyActions
        />
        <div className="admin-table-wrap">
          <table id="admin-dashboard-moderation-table" className="admin-table">
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
                <tr key={listing.id} data-row-id={listing.id}>
                  <td data-label="Listing">
                    <span className="font-semibold">{listing.title}</span>
                  </td>
                  <td data-label="Status">
                    <span
                      className="admin-status-badge"
                      data-status={listing.status.toLowerCase()}
                    >
                      {listing.status}
                    </span>
                  </td>
                  <td data-label="Category">{listing.subcategory}</td>
                  <td data-label="Location">{listing.location}</td>
                  <td data-label="Price">{listing.priceLabel}</td>
                  <td data-label="Actions">
                    <div className="admin-row-actions">
                      {(["ACTIVE", "REJECTED", "DELETED"] as const).map(
                        (status) => (
                          <form key={status} action={moderateListingAction}>
                            <input
                              type="hidden"
                              name="listingId"
                              value={listing.id}
                            />
                            <input type="hidden" name="status" value={status} />
                            <input type="hidden" name="returnTo" value="/admin" />
                            <AdminSubmitButton
                              className="admin-table-action"
                              confirmMessage={`${
                                status === "ACTIVE"
                                  ? "Approve"
                                  : status === "REJECTED"
                                    ? "Reject"
                                    : "Delete"
                              } "${listing.title}"? This changes the listing status for customers and the seller.`}
                              pendingText="Updating..."
                            >
                              {status === "ACTIVE"
                                ? "Approve"
                                : status === "REJECTED"
                                  ? "Reject"
                                  : "Delete"}
                            </AdminSubmitButton>
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
            <div className="admin-empty-state">
              <p className="admin-empty-state-title">No listings found</p>
              <p className="admin-empty-state-copy">
                New seller submissions and recent listings will appear here for moderation.
              </p>
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
