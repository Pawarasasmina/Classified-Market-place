import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchCategoryIncomeReport } from "@/lib/marketplace-api";
import {
  humanizeTransactionStatus,
  humanizeTransactionType,
  type ApiTransactionStatus,
  type ApiTransactionType,
} from "@/lib/marketplace";

type CategoryIncomeReportPageProps = {
  searchParams: Promise<{
    days?: string;
    email?: string;
    message?: string;
  }>;
};

const dayOptions = [7, 30, 90, 180] as const;
const transactionStatuses: ApiTransactionStatus[] = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];
const incomeTypes: ApiTransactionType[] = ["LISTING_FEE", "BOOST_PURCHASE"];

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

export default async function CategoryIncomeReportPage(
  props: CategoryIncomeReportPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/category-income",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports/category-income?days=${selectedDays}`;
  const report = await fetchCategoryIncomeReport(accessToken, {
    days: selectedDays,
    take: 100,
  });
  const maxCategoryRevenue = Math.max(
    1,
    ...report.categories.map((category) => category.revenue),
  );
  const maxStatusCount = Math.max(
    1,
    ...transactionStatuses.map(
      (status) => report.commerce.transactionStatuses[status] ?? 0,
    ),
  );
  const revenueTypeRows = incomeTypes.map((type) => ({
    type,
    count: report.commerce.revenueByType[type]?.count ?? 0,
    revenue: report.commerce.revenueByType[type]?.revenue ?? 0,
  }));
  const maxTypeRevenue = Math.max(
    1,
    ...revenueTypeRows.map((type) => type.revenue),
  );

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Revenue report
          </p>
          <h1 className="mt-1 text-2xl font-bold">Category-wise income</h1>
          <p className="mt-2 text-[var(--muted)]">
            {formatDate(report.range.from)} to {formatDate(report.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="category-income"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/category-income?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
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
            href="/admin/reports"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Operations report
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Revenue",
            formatMoney(report.overview.totalRevenue),
            "settled category income",
          ],
          [
            "Listing fees",
            formatMoney(report.overview.listingFeeRevenue),
            "paid listing revenue",
          ],
          [
            "Boost revenue",
            formatMoney(report.overview.boostRevenue),
            "boost purchases",
          ],
          [
            "Pending",
            formatMoney(report.overview.pendingRevenue),
            "awaiting payment",
          ],
          [
            "Categories",
            report.overview.categoriesRepresented,
            "earning categories",
          ],
          [
            "Income listings",
            report.overview.incomeListings,
            "listings with payments",
          ],
          ["Sellers", report.overview.sellersRepresented, "represented"],
          ["Paid listings", report.overview.paidListings, "fee or priority"],
          [
            "Boosted listings",
            report.overview.boostedListings,
            "boost revenue",
          ],
          [
            "Top category",
            report.overview.topCategory?.name ?? "None",
            report.overview.topCategory
              ? `${report.overview.topCategory.revenueShare}% of revenue`
              : "waiting for income",
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
        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Income Type</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Settled revenue grouped by marketplace income source.
            </p>
          </div>
          <div className="grid gap-3">
            {revenueTypeRows.map((row) => (
              <div key={row.type} className="grid gap-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{humanizeTransactionType(row.type)}</span>
                  <span className="font-bold">{formatMoney(row.revenue)}</span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                  <div
                    className="h-2 rounded-full bg-[var(--brand)]"
                    style={{ width: barWidth(row.revenue, maxTypeRevenue) }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {formatMetric(row.count)} successful payments
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Payment Status</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Listing fee and boost purchase outcomes.
            </p>
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
                      style={{ width: barWidth(value, maxStatusCount) }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-[var(--muted)]">
              {report.commerce.paymentConversionRate}% conversion /{" "}
              {formatMoney(report.commerce.averageOrderValue)} average order
            </p>
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Provider Mix</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Successful category income by payment provider.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {report.commerce.revenueByProvider.map((provider) => (
              <div
                key={provider.provider}
                className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-4"
              >
                <p className="text-sm text-[var(--muted)]">
                  {humanizeLabel(provider.provider)}
                </p>
                <p className="mt-2 text-2xl font-black">
                  {formatMoney(provider.revenue)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatMetric(provider.count)} successful payments
                </p>
              </div>
            ))}
            {report.commerce.revenueByProvider.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Provider revenue will appear here.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Category Income</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Categories ranked by settled listing fee and boost revenue.
            </p>
          </div>
          <div className="grid gap-3">
            {report.categories.map((category) => (
              <div key={category.id} className="grid gap-2">
                <div className="flex flex-wrap justify-between gap-3 text-sm">
                  <div>
                    <Link
                      href={`/search?category=${category.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {category.name}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(category.listingCount)} listings /{" "}
                      {formatMetric(category.sellersRepresented)} sellers /{" "}
                      {category.revenueShare}% share
                    </span>
                  </div>
                  <span className="font-bold">
                    {formatMoney(category.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent-strong)]"
                    style={{
                      width: barWidth(category.revenue, maxCategoryRevenue),
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Fees {formatMoney(category.listingFeeRevenue)} / Boosts{" "}
                  {formatMoney(category.boostRevenue)} / Pending{" "}
                  {formatMoney(category.pendingRevenue)}
                </p>
              </div>
            ))}
            {report.categories.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Category income will appear once paid listings or boosts are
                sold.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Engagement Yield</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Income categories compared with buyer activity.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Views", report.engagement.views],
              ["Saves", report.engagement.saves],
              ["Inquiries", report.engagement.inquiries],
              ["Reports", report.engagement.reports],
              ["Conversion", `${report.engagement.inquiryConversionRate}%`],
              [
                "Revenue per inquiry",
                formatMoney(report.engagement.averageRevenuePerInquiry),
              ],
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
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Income Listings</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Listings contributing category income in this window.
            </p>
          </div>
          <Link
            href="/admin/transactions"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Open ledger
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Category</th>
                <th>Seller</th>
                <th>Revenue</th>
                <th>Payments</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {report.topListings.map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <Link
                      href={`/listings/${listing.id}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {listing.title}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {humanizeLabel(listing.status)} /{" "}
                      {humanizeLabel(listing.listingPaymentMode)}
                    </span>
                  </td>
                  <td>{listing.category.name}</td>
                  <td>
                    <Link
                      href={`/sellers/${listing.seller.id}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {listing.seller.displayName}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {humanizeLabel(
                        listing.seller.sellerPriorityTier ?? "NONE",
                      )}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMoney(listing.revenue)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Fees {formatMoney(listing.listingFeeRevenue)} / Boosts{" "}
                      {formatMoney(listing.boostRevenue)}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(listing.transactionCount)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Pending {formatMoney(listing.pendingRevenue)}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(listing.viewCount)} views
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(listing.inquiryCount)} inquiries /{" "}
                      {listing.inquiryConversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.topListings.length === 0 ? (
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No category income matches this window.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
