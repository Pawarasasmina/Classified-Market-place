import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchBoostRevenueReport } from "@/lib/marketplace-api";
import {
  humanizeBoostPlacement,
  humanizeTransactionStatus,
  type ApiTransactionStatus,
} from "@/lib/marketplace";

type BoostRevenueReportPageProps = {
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

export default async function BoostRevenueReportPage(
  props: BoostRevenueReportPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/boost-revenue",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports/boost-revenue?days=${selectedDays}`;
  const report = await fetchBoostRevenueReport(accessToken, {
    days: selectedDays,
    take: 100,
  });
  const maxStatusCount = Math.max(
    1,
    ...transactionStatuses.map(
      (status) => report.commerce.transactionStatuses[status] ?? 0,
    ),
  );
  const maxPlacementRevenue = Math.max(
    1,
    ...report.boosts.placements.map((placement) => placement.revenue),
  );
  const maxPackageRevenue = Math.max(
    1,
    ...report.packages.map((boostPackage) => boostPackage.revenue),
  );

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Revenue report
          </p>
          <h1 className="mt-1 text-2xl font-bold">Boost revenue</h1>
          <p className="mt-2 text-[var(--muted)]">
            {formatDate(report.range.from)} to {formatDate(report.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="boost-revenue"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/boost-revenue?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
          <Link
            href="/admin/boosts"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Active boosts
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
            formatMoney(report.commerce.revenue),
            "settled boost spend",
          ],
          [
            "Pending",
            formatMoney(report.commerce.pendingRevenue),
            "awaiting payment",
          ],
          ["Purchases", report.overview.boostPurchases, "all attempts"],
          [
            "Successful",
            report.overview.successfulPurchases,
            `${report.commerce.paymentConversionRate}% conversion`,
          ],
          [
            "Active boosts",
            report.overview.activeBoosts,
            `${report.overview.expiringBoosts} expiring soon`,
          ],
          [
            "Wallet revenue",
            formatMoney(report.commerce.walletRevenue),
            "wallet paid",
          ],
          [
            "Gateway revenue",
            formatMoney(report.commerce.gatewayRevenue),
            "non-wallet paid",
          ],
          [
            "AOV",
            formatMoney(report.commerce.averageOrderValue),
            "successful order",
          ],
          ["Packages", report.overview.packagesRepresented, "represented"],
          ["Placements", report.overview.placementsRepresented, "represented"],
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
            <h2 className="text-xl font-semibold">Payment Status</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Boost purchase transaction outcomes.
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
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Placement Revenue</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Revenue and views by boost placement.
            </p>
          </div>
          <div className="grid gap-3">
            {report.boosts.placements.map((placement) => (
              <div key={placement.placement} className="grid gap-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{humanizeBoostPlacement(placement.placement)}</span>
                  <span className="font-bold">
                    {formatMoney(placement.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                  <div
                    className="h-2 rounded-full bg-[var(--brand)]"
                    style={{
                      width: barWidth(placement.revenue, maxPlacementRevenue),
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {formatMetric(placement.boosts)} boosts /{" "}
                  {formatMetric(placement.viewCount)} boosted views
                </p>
              </div>
            ))}
            {report.boosts.placements.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Placement revenue will appear here.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Payment Method Mix</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Successful boost revenue grouped by provider.
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

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Package Revenue</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Packages ranked by settled boost revenue.
            </p>
          </div>
          <div className="grid gap-3">
            {report.packages.map((boostPackage) => (
              <div
                key={boostPackage.id ?? boostPackage.name}
                className="grid gap-2"
              >
                <div className="flex justify-between gap-3 text-sm">
                  <span>{boostPackage.name}</span>
                  <span className="font-bold">
                    {formatMoney(boostPackage.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent-strong)]"
                    style={{
                      width: barWidth(boostPackage.revenue, maxPackageRevenue),
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {formatMetric(boostPackage.purchases)} purchases /{" "}
                  {formatMetric(boostPackage.activeBoosts)} active /{" "}
                  {formatMetric(boostPackage.viewCount)} views
                </p>
              </div>
            ))}
            {report.packages.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Boost package revenue will appear here.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Top Boosted Listings</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Listings producing the most boost revenue.
            </p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Revenue</th>
                  <th>Boosts</th>
                  <th>Views</th>
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
                        {listing.categoryName ?? "Uncategorized"} /{" "}
                        {humanizeLabel(listing.status)}
                      </span>
                    </td>
                    <td>{formatMoney(listing.revenue)}</td>
                    <td>{formatMetric(listing.boosts)}</td>
                    <td>{formatMetric(listing.viewCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.topListings.length === 0 ? (
              <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                Boosted listings will appear here.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Boost Purchases</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Recent boost orders with package, listing, and payment context.
            </p>
          </div>
          <Link
            href="/admin/transactions?type=BOOST_PURCHASE"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Open boost ledger
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Boost</th>
                <th>Listing</th>
                <th>Seller</th>
                <th>Payment</th>
                <th>Window</th>
                <th>Views</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((boost) => (
                <tr key={boost.id}>
                  <td>
                    <span className="font-semibold">
                      {boost.package?.name ??
                        humanizeBoostPlacement(boost.placement)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {humanizeBoostPlacement(boost.placement)} /{" "}
                      {humanizeLabel(boost.status)}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/listings/${boost.listing.id}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {boost.listing.title}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {boost.listing.category?.name ?? "Uncategorized"}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/sellers/${boost.purchaser.id}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {boost.purchaser.displayName}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {humanizeLabel(
                        boost.purchaser.sellerPriorityTier ?? "NONE",
                      )}{" "}
                      / Reputation{" "}
                      {formatMetric(boost.purchaser.reputationScore)}
                    </span>
                  </td>
                  <td>
                    {boost.transaction ? (
                      <>
                        <span className="font-semibold">
                          {formatMoney(
                            boost.transaction.amount,
                            boost.transaction.currency,
                          )}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          {humanizeTransactionStatus(boost.transaction.status)}{" "}
                          /{" "}
                          {humanizeLabel(
                            boost.transaction.provider ?? "unknown",
                          )}
                        </span>
                      </>
                    ) : (
                      "No transaction"
                    )}
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatDate(boost.startsAt)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Ends {formatDate(boost.endsAt)}
                    </span>
                  </td>
                  <td>{formatMetric(boost.viewCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.rows.length === 0 ? (
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No boost purchases match this window.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
