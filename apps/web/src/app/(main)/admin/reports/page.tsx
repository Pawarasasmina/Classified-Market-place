import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminMonitoringReport } from "@/lib/marketplace-api";
import {
  humanizeReportStatus,
  humanizeTransactionStatus,
  humanizeTransactionType,
  type ApiBoostStatus,
  type ApiListingStatus,
  type ApiReportStatus,
  type ApiSellerReviewStatus,
  type ApiTransactionStatus,
  type ApiTransactionType,
} from "@/lib/marketplace";

type AdminReportsPageProps = {
  searchParams: Promise<{
    days?: string;
    email?: string;
    message?: string;
  }>;
};

const dayOptions = [7, 30, 90, 180] as const;
const listingStatuses: ApiListingStatus[] = [
  "PENDING",
  "ACTIVE",
  "REJECTED",
  "DELETED",
  "EXPIRED",
  "SOLD",
  "REMOVED",
  "DRAFT",
];
const reportStatuses: ApiReportStatus[] = [
  "OPEN",
  "REVIEWED",
  "ACTIONED",
  "DISMISSED",
  "RESOLVED",
];
const sellerReviewStatuses: ApiSellerReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
];
const transactionStatuses: ApiTransactionStatus[] = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];
const transactionTypes: ApiTransactionType[] = [
  "BOOST_PURCHASE",
  "LISTING_FEE",
  "WALLET_TOP_UP",
  "ADMIN_ADJUSTMENT",
  "REFUND",
];
const boostStatuses: ApiBoostStatus[] = [
  "SCHEDULED",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
];

function humanizeLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetric(value: number) {
  return value.toLocaleString("en");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDelta(value: number, mode: "number" | "money" = "number") {
  const sign = value > 0 ? "+" : "";
  const formatted =
    mode === "money"
      ? formatMoney(Math.abs(value))
      : formatMetric(Math.abs(value));

  return `${sign}${value < 0 ? "-" : ""}${formatted}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function barWidth(value: number, max: number) {
  if (!max) {
    return "0%";
  }

  return `${Math.max(4, Math.min(100, (value / max) * 100))}%`;
}

function severityClass(severity: string) {
  if (severity === "high") {
    return "border-red-300/40 bg-red-500/10 text-[var(--danger-text)]";
  }

  if (severity === "medium") {
    return "border-amber-300/40 bg-amber-500/10 text-[var(--warning-text)]";
  }

  return "border-[var(--line)] bg-[rgba(8,13,29,0.42)] text-[var(--foreground)]";
}

export default async function AdminReportsPage(props: AdminReportsPageProps) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext("/admin/reports");

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports?days=${selectedDays}`;
  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const report = await fetchAdminMonitoringReport(accessToken, {
    days: selectedDays,
    topTake: 8,
  });
  const maxListingStatus = Math.max(
    1,
    ...listingStatuses.map(
      (status) => report.moderation.listingStatuses[status] ?? 0,
    ),
  );
  const maxReportStatus = Math.max(
    1,
    ...reportStatuses.map(
      (status) => report.moderation.totalReports[status] ?? 0,
    ),
  );
  const maxTransactionStatus = Math.max(
    1,
    ...transactionStatuses.map(
      (status) => report.commerce.transactionStatuses[status] ?? 0,
    ),
  );

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Reports and monitoring"
        title="Operations report"
        description={`${formatDate(report.range.from)} to ${formatDate(
          report.range.to,
        )}`}
        actions={
          <>
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, topTake: 8 }}
              message={searchParams.message}
              reportType="monitoring"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
          <Link
            href={`/admin/reports/active-listings?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Active listings
          </Link>
          <Link
            href={`/admin/reports/paid-listings?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Paid listings
          </Link>
          <Link
            href={`/admin/reports/boost-revenue?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Boost revenue
          </Link>
          <Link
            href={`/admin/reports/category-income?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Category income
          </Link>
          <Link
            href={`/admin/reports/wallet-payments?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Wallet payments
          </Link>
          <Link
            href={`/admin/reports/sellers?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Total sellers
          </Link>
          <Link
            href={`/admin/reports/top-sellers?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Top sellers
          </Link>
          <Link
            href={`/admin/reports/seller-approvals?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Pending approvals
          </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Revenue",
            formatMoney(report.overview.totalRevenue),
            formatDelta(report.overview.totalRevenueDelta, "money"),
          ],
          [
            "Open reports",
            formatMetric(report.overview.openReports),
            "all queues",
          ],
          [
            "Active boosts",
            formatMetric(report.overview.activeBoosts),
            `${report.boosts.expiringWithin24Hours} expiring`,
          ],
          [
            "New users",
            formatMetric(report.overview.newUsers),
            formatDelta(report.overview.newUsersDelta),
          ],
          [
            "New listings",
            formatMetric(report.overview.newListings),
            formatDelta(report.overview.newListingsDelta),
          ],
        ].map(([label, value, detail]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              {detail}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        {report.alerts.map((alert) => (
          <div
            key={alert.key}
            className={`rounded-lg border p-4 ${severityClass(alert.severity)}`}
          >
            <p className="text-sm font-black">{alert.label}</p>
            <p className="mt-2 text-3xl font-black">{alert.value}</p>
            <p className="mt-2 text-sm opacity-80">{alert.message}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Moderation Health</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Listing status, report status, and review queues.
              </p>
            </div>
            <Link
              href="/admin/listing-reports"
              className="action-secondary px-3 py-2 text-sm font-semibold"
            >
              Review reports
            </Link>
          </div>
          <div className="grid gap-3">
            {listingStatuses.map((status) => {
              const value = report.moderation.listingStatuses[status] ?? 0;

              return (
                <div key={status} className="grid gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{humanizeLabel(status)}</span>
                    <span className="font-bold">{formatMetric(value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                    <div
                      className="h-2 rounded-full bg-[var(--brand)]"
                      style={{ width: barWidth(value, maxListingStatus) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sellerReviewStatuses.map((status) => (
              <div
                key={status}
                className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-3"
              >
                <p className="text-sm text-[var(--muted)]">
                  Reviews {humanizeLabel(status)}
                </p>
                <p className="mt-1 text-2xl font-black">
                  {formatMetric(report.moderation.sellerReviews[status] ?? 0)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Report Volume</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Listing, conversation, and message reports by workflow status.
              </p>
            </div>
            <Link
              href="/messages"
              className="action-secondary px-3 py-2 text-sm font-semibold"
            >
              Support inbox
            </Link>
          </div>
          <div className="grid gap-3">
            {reportStatuses.map((status) => {
              const value = report.moderation.totalReports[status] ?? 0;

              return (
                <div
                  key={status}
                  className="rounded-lg border border-[var(--line)] p-3"
                >
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-bold">
                      {humanizeReportStatus(status)}
                    </span>
                    <span>{formatMetric(value)}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                    <div
                      className="h-2 rounded-full bg-[var(--accent-strong)]"
                      style={{ width: barWidth(value, maxReportStatus) }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Listings {report.moderation.listingReports[status] ?? 0} /
                    Conversations{" "}
                    {report.moderation.conversationReports[status] ?? 0} /
                    Messages {report.moderation.messageReports[status] ?? 0}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Commerce Monitoring</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Payment status and revenue mix for the selected window.
              </p>
            </div>
            <Link
              href="/admin/transactions"
              className="action-secondary px-3 py-2 text-sm font-semibold"
            >
              Open ledger
            </Link>
          </div>
          <div className="grid gap-3">
            {transactionStatuses.map((status) => {
              const value = report.commerce.transactionStatuses[status] ?? 0;

              return (
                <div key={status} className="grid gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{humanizeTransactionStatus(status)}</span>
                    <span className="font-bold">{formatMetric(value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                    <div
                      className="h-2 rounded-full bg-[var(--success)]"
                      style={{ width: barWidth(value, maxTransactionStatus) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {transactionTypes.map((type) => (
              <div
                key={type}
                className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-3"
              >
                <p className="text-sm text-[var(--muted)]">
                  {humanizeTransactionType(type)}
                </p>
                <p className="mt-1 text-2xl font-black">
                  {formatMoney(report.commerce.revenueByType[type] ?? 0)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Engagement Monitoring</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Marketplace activity and inquiry conversion.
            </p>
          </div>
          <section className="grid gap-3 sm:grid-cols-2">
            {[
              [
                "Listing views",
                formatMetric(report.engagement.listingViews),
                formatDelta(report.engagement.listingViewsDelta),
              ],
              [
                "Saved listings",
                formatMetric(report.engagement.savedListings),
                "saved",
              ],
              [
                "Conversations",
                formatMetric(report.engagement.conversations),
                "new threads",
              ],
              [
                "Messages",
                formatMetric(report.engagement.messages),
                `${report.engagement.inquiryConversionRate}% conversion`,
              ],
            ].map(([label, value, detail]) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-4"
              >
                <p className="text-sm text-[var(--muted)]">{label}</p>
                <p className="mt-2 text-3xl font-bold">{value}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  {detail}
                </p>
              </div>
            ))}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            {boostStatuses.map((status) => (
              <div
                key={status}
                className="rounded-lg border border-[var(--line)] p-3"
              >
                <p className="text-sm text-[var(--muted)]">
                  Boosts {humanizeLabel(status)}
                </p>
                <p className="mt-1 text-2xl font-black">
                  {formatMetric(report.boosts.statuses[status] ?? 0)}
                </p>
              </div>
            ))}
          </section>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Top Viewed Listings</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Listings with the highest views in the selected window.
            </p>
          </div>
          <AdminTableEnhancer
            tableId="admin-reports-top-listings-table"
            copyLabel="listing IDs"
          />
          <div className="admin-table-wrap">
            <table id="admin-reports-top-listings-table" className="admin-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Saves</th>
                  <th>Inquiries</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {report.topListings.map((listing) => (
                  <tr key={listing.id} data-row-id={listing.id}>
                    <td data-label="Listing">
                      <Link
                        href={`/listings/${listing.id}?view=customer`}
                        className="font-semibold"
                      >
                        {listing.title}
                      </Link>
                      <span className="block text-xs text-[var(--muted)]">
                        {listing.categoryName ?? "Uncategorized"} /{" "}
                        {listing.sellerName ?? listing.sellerId}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span
                        className="admin-status-badge"
                        data-status={listing.status.toLowerCase()}
                      >
                        {humanizeLabel(listing.status)}
                      </span>
                    </td>
                    <td data-label="Views">{formatMetric(listing.viewCount)}</td>
                    <td data-label="Saves">{formatMetric(listing.saveCount)}</td>
                    <td data-label="Inquiries">
                      {formatMetric(listing.inquiryCount)}
                    </td>
                    <td data-label="Reports">
                      {formatMetric(listing.reportCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.topListings.length === 0 ? (
              <div className="admin-empty-state">
                <p className="admin-empty-state-title">No top listings found</p>
                <p className="admin-empty-state-copy">
                  Listing engagement will appear here once views are recorded in the selected window.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Recent Reports</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Latest listing, conversation, and message reports.
            </p>
          </div>
          <div className="grid gap-3">
            {report.recentReports.map((item) => (
              <article
                key={`${item.type}-${item.id}`}
                className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="admin-status-badge" data-status="none">
                    {humanizeLabel(item.type)}
                  </span>
                  <span
                    className="admin-status-badge"
                    data-status={item.status.toLowerCase()}
                  >
                    {humanizeReportStatus(item.status)}
                  </span>
                </div>
                <h3 className="mt-3 font-black">
                  {item.targetTitle ?? item.targetId}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.reason}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {item.reporter?.displayName ?? "Reporter"} /{" "}
                  {formatDate(item.createdAt)}
                </p>
              </article>
            ))}
            {report.recentReports.length === 0 ? (
              <div className="admin-empty-state rounded-lg border border-[var(--line)]">
                <p className="admin-empty-state-title">No recent reports</p>
                <p className="admin-empty-state-copy">
                  Listing, conversation, and message reports will appear here as they are submitted.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
