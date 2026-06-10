import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchPaidListingsReport } from "@/lib/marketplace-api";
import {
  humanizeBoostPlacement,
  humanizeTransactionStatus,
  type ApiTransactionStatus,
} from "@/lib/marketplace";

type PaidListingsReportPageProps = {
  searchParams: Promise<{
    days?: string;
    email?: string;
    message?: string;
  }>;
};

const dayOptions = [7, 30, 90, 180] as const;
const paymentStatuses: ApiTransactionStatus[] = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

function humanizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(value: number) {
  return value.toLocaleString("en");
}

function formatMoney(value: number, currency = "AED") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

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

export default async function PaidListingsReportPage(
  props: PaidListingsReportPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/paid-listings",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports/paid-listings?days=${selectedDays}`;
  const report = await fetchPaidListingsReport(accessToken, {
    days: selectedDays,
    take: 100,
  });
  const maxCategoryCount = Math.max(
    1,
    ...report.categories.map((category) => category.paidListings),
  );
  const maxPaymentStatus = Math.max(
    1,
    ...paymentStatuses.map((status) => report.paymentStatuses[status] ?? 0),
  );

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Listing report"
        title="Paid listings"
        description={`${formatDate(report.range.from)} to ${formatDate(
          report.range.to,
        )}`}
        actions={
          <>
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="paid-listings"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/paid-listings?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
          <Link
            href="/admin/reports/active-listings"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Active listings
          </Link>
          <Link
            href="/admin/reports"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Operations report
          </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Paid listings", report.overview.paidListings, "paid inventory"],
          ["Active paid", report.overview.activePaidListings, "currently live"],
          [
            "Pending paid",
            report.overview.pendingPaidListings,
            "awaiting review",
          ],
          [
            "Boosted paid",
            report.overview.boostedPaidListings,
            "with active boosts",
          ],
          [
            "Reported paid",
            report.overview.reportedPaidListings,
            "recent reports",
          ],
          ["Revenue", formatMoney(report.commerce.revenue), "successful fees"],
          [
            "Pending revenue",
            formatMoney(report.commerce.pendingRevenue),
            "not settled",
          ],
          ["Failed payments", report.commerce.failedPayments, "listing fees"],
          [
            "Conversion",
            `${report.commerce.paymentConversionRate}%`,
            "payment success",
          ],
          [
            "Avg views",
            report.engagement.averageViewsPerListing,
            "per listing",
          ],
        ].map(([label, value, detail]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">
              {typeof value === "number" ? formatMetric(value) : value}
            </p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              {detail}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="panel grid gap-4 xl:col-span-1">
          <div>
            <h2 className="text-xl font-semibold">Payment Status</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Listing fee transactions in the selected window.
            </p>
          </div>
          <div className="grid gap-3">
            {paymentStatuses.map((status) => {
              const value = report.paymentStatuses[status] ?? 0;

              return (
                <div key={status} className="grid gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{humanizeTransactionStatus(status)}</span>
                    <span className="font-bold">{formatMetric(value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                    <div
                      className="h-2 rounded-full bg-[var(--success)]"
                      style={{ width: barWidth(value, maxPaymentStatus) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel grid gap-4 xl:col-span-1">
          <div>
            <h2 className="text-xl font-semibold">Engagement</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Recent performance for paid listing inventory.
            </p>
          </div>
          <section className="grid gap-3 sm:grid-cols-2">
            {[
              ["Views", report.engagement.views],
              ["Saves", report.engagement.saves],
              ["Inquiries", report.engagement.inquiries],
              ["Reports", report.engagement.reports],
              ["Boosts bought", report.engagement.boosts],
              ["Conversion", `${report.engagement.inquiryConversionRate}%`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-4"
              >
                <p className="text-sm text-[var(--muted)]">{label}</p>
                <p className="mt-2 text-2xl font-black">
                  {typeof value === "number" ? formatMetric(value) : value}
                </p>
              </div>
            ))}
          </section>
        </div>

        <div className="panel grid gap-4 xl:col-span-1">
          <div>
            <h2 className="text-xl font-semibold">Category Mix</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Paid listings grouped by category.
            </p>
          </div>
          <div className="grid gap-3">
            {report.categories.map((category) => (
              <div key={category.id} className="grid gap-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{category.name}</span>
                  <span className="font-bold">
                    {formatMetric(category.paidListings)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                  <div
                    className="h-2 rounded-full bg-[var(--brand)]"
                    style={{
                      width: barWidth(category.paidListings, maxCategoryCount),
                    }}
                  />
                </div>
              </div>
            ))}
            {report.categories.length === 0 ? (
              <div className="admin-empty-state">
                <p className="admin-empty-state-title">
                  No paid listing categories
                </p>
                <p className="admin-empty-state-copy">
                  Categories with paid listing activity will appear here once
                  listing fee purchases settle.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Paid Listing Performance</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ranked by listing-fee revenue, recent views, and inquiries.
            </p>
          </div>
          <Link
            href="/admin/transactions?type=LISTING_FEE"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Open listing fees
          </Link>
        </div>

        <AdminTableEnhancer
          tableId="admin-paid-listings-report-table"
          copyLabel="listing IDs"
        />
        <div className="admin-table-wrap">
          <table id="admin-paid-listings-report-table" className="admin-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Seller</th>
                <th>Payment</th>
                <th>Priority</th>
                <th>Engagement</th>
                <th>Risk</th>
                <th>Boost</th>
              </tr>
            </thead>
            <tbody>
              {report.listings.map((listing) => (
                <tr key={listing.id} data-row-id={listing.id}>
                  <td data-label="Listing">
                    <Link
                      href={`/listings/${listing.id}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {listing.title}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {listing.category.name} / {listing.location}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMoney(listing.price, listing.currency)} /{" "}
                      {humanizeLabel(listing.status)}
                    </span>
                  </td>
                  <td data-label="Seller">
                    <Link
                      href={`/sellers/${listing.sellerId}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {listing.seller.displayName}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {humanizeLabel(
                        listing.seller.sellerPriorityTier ?? "NONE",
                      )}{" "}
                      / Reputation{" "}
                      {formatMetric(listing.seller.reputationScore)}
                    </span>
                  </td>
                  <td data-label="Payment">
                    <span className="font-semibold">
                      {formatMoney(listing.paymentRevenue)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {listing.paymentStatus
                        ? humanizeTransactionStatus(listing.paymentStatus)
                        : "No fee transaction"}
                      {" / "}
                      {formatMetric(listing.paymentTransactionCount)} fee
                      transactions
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Pending {formatMoney(listing.pendingAmount)} / Refunded{" "}
                      {formatMoney(listing.refundedAmount)}
                    </span>
                  </td>
                  <td data-label="Priority">
                    <span className="font-semibold">
                      {listing.listingPaymentMode === "PAID"
                        ? "Paid listing"
                        : "Priority flag"}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {listing.adminPriorityPinned
                        ? "Pinned"
                        : listing.adminPriorityPromoted
                          ? "Promoted"
                          : listing.paidPriorityEnabled
                            ? "Paid priority"
                            : "Fee paid"}
                      {listing.adminPriorityScore != null
                        ? ` / ${listing.adminPriorityScore}`
                        : ""}
                    </span>
                  </td>
                  <td data-label="Engagement">
                    <span className="font-semibold">
                      {formatMetric(listing.viewCount)} views
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(listing.saveCount)} saves /{" "}
                      {formatMetric(listing.inquiryCount)} inquiries /{" "}
                      {listing.inquiryConversionRate}%
                    </span>
                  </td>
                  <td data-label="Risk">
                    <span className="font-semibold">
                      {formatMetric(listing.reportCount)} recent
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(listing.lifetimeReportCount)} lifetime
                    </span>
                  </td>
                  <td data-label="Boost">
                    {listing.activeBoostCount ? (
                      <>
                        <span className="font-semibold">
                          {formatMetric(listing.activeBoostCount)} active
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          {listing.activeBoostPlacements
                            .map(humanizeBoostPlacement)
                            .join(", ")}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          Ends {formatDate(listing.nextBoostEndsAt)}
                        </span>
                      </>
                    ) : (
                      "No active boost"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.listings.length === 0 ? (
            <div className="admin-empty-state">
              <p className="admin-empty-state-title">No paid listings</p>
              <p className="admin-empty-state-copy">
                No paid listings match the selected filters. Try a wider date
                window or inspect listing fee transactions.
              </p>
              <Link
                href="/admin/transactions?type=LISTING_FEE"
                className="action-secondary px-3 py-2 text-sm font-semibold"
              >
                Open listing fees
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
