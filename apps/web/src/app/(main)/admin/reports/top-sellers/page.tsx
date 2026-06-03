import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchTopSellersReport } from "@/lib/marketplace-api";
import type { ApiTopSellerReportRow } from "@/lib/marketplace";

type TopSellersReportPageProps = {
  searchParams: Promise<{
    days?: string;
    email?: string;
    message?: string;
  }>;
};

const dayOptions = [7, 30, 90, 180] as const;

function humanizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function leaderDetail(seller: ApiTopSellerReportRow | null, mode: string) {
  if (!seller) {
    return "No qualifying seller";
  }

  if (mode === "revenue") {
    return `${formatMoney(seller.revenue)} revenue`;
  }

  if (mode === "engagement") {
    return `${formatMetric(seller.viewCount)} views / ${formatMetric(
      seller.inquiryCount,
    )} inquiries`;
  }

  if (mode === "conversion") {
    return `${seller.inquiryConversionRate}% inquiry conversion`;
  }

  if (mode === "rating") {
    return seller.averageRating
      ? `${seller.averageRating.toFixed(1)} rating / ${formatMetric(
          seller.ratingCount,
        )} ratings`
      : "No ratings";
  }

  return `${formatMetric(seller.performanceScore)} score`;
}

export default async function TopSellersReportPage(
  props: TopSellersReportPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/top-sellers",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports/top-sellers?days=${selectedDays}`;
  const report = await fetchTopSellersReport(accessToken, {
    days: selectedDays,
    take: 100,
  });
  const leaders = [
    ["Overall leader", report.overview.topSeller, "score"],
    ["Revenue leader", report.leaders.revenue, "revenue"],
    ["Engagement leader", report.leaders.engagement, "engagement"],
    ["Conversion leader", report.leaders.conversion, "conversion"],
    ["Rating leader", report.leaders.rating, "rating"],
  ] as const;

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Seller report
          </p>
          <h1 className="mt-1 text-2xl font-bold">Top sellers</h1>
          <p className="mt-2 text-[var(--muted)]">
            {formatDate(report.range.from)} to {formatDate(report.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="top-sellers"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/top-sellers?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
          <Link
            href={`/admin/reports/sellers?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Total sellers
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
          ["Ranked sellers", report.overview.rankedSellers, "with listings"],
          [
            "Active sellers",
            report.overview.activeTopSellers,
            "with live inventory",
          ],
          [
            "Revenue",
            formatMoney(report.overview.totalRevenue),
            "selected window",
          ],
          ["Views", report.overview.totalViews, "listing views"],
          ["Inquiries", report.overview.totalInquiries, "buyer conversations"],
          [
            "Avg score",
            report.overview.averagePerformanceScore,
            "top seller score",
          ],
          [
            "Top seller",
            report.overview.topSeller?.displayName ?? "None",
            report.overview.topSeller
              ? `#${report.overview.topSeller.rank} / ${formatMetric(
                  report.overview.topSeller.performanceScore,
                )}`
              : "waiting for activity",
          ],
          [
            "Boost revenue",
            formatMoney(
              report.sellers.reduce(
                (sum, seller) => sum + seller.boostRevenue,
                0,
              ),
            ),
            "from top sellers",
          ],
          [
            "Listing fees",
            formatMoney(
              report.sellers.reduce(
                (sum, seller) => sum + seller.listingFeeRevenue,
                0,
              ),
            ),
            "from top sellers",
          ],
          [
            "Reports",
            report.sellers.reduce((sum, seller) => sum + seller.reportCount, 0),
            "risk signals",
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

      <section className="grid gap-3 lg:grid-cols-5">
        {leaders.map(([label, seller, mode]) => (
          <article
            key={label}
            className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-4"
          >
            <p className="text-sm text-[var(--muted)]">{label}</p>
            {seller ? (
              <Link
                href={`/sellers/${seller.id}?view=customer`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-xl font-black"
              >
                {seller.displayName}
              </Link>
            ) : (
              <p className="mt-2 text-xl font-black">None</p>
            )}
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              {leaderDetail(seller, mode)}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Seller Leaderboard</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ranked by revenue, engagement, inventory, ratings, reputation, and
              risk.
            </p>
          </div>
          <Link
            href="/admin/users"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Manage users
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Seller</th>
                <th>Score</th>
                <th>Listings</th>
                <th>Engagement</th>
                <th>Revenue</th>
                <th>Ratings</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {report.sellers.map((seller) => (
                <tr key={seller.id}>
                  <td className="font-black">#{seller.rank}</td>
                  <td>
                    <Link
                      href={`/sellers/${seller.id}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {seller.displayName}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {seller.email}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {humanizeLabel(seller.sellerPriorityTier)} /{" "}
                      {seller.emailVerified || seller.phoneVerified
                        ? "Verified contact"
                        : "Unverified contact"}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(seller.performanceScore)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Reputation {formatMetric(seller.reputationScore)}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(seller.totalListings)} total
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(seller.activeListings)} active /{" "}
                      {formatMetric(seller.newListings)} new /{" "}
                      {formatMetric(seller.paidListings)} paid /{" "}
                      {formatMetric(seller.soldListings)} sold
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(seller.viewCount)} views
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(seller.saveCount)} saves /{" "}
                      {formatMetric(seller.inquiryCount)} inquiries /{" "}
                      {seller.inquiryConversionRate}%
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMoney(seller.revenue)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Boosts {formatMoney(seller.boostRevenue)} / Fees{" "}
                      {formatMoney(seller.listingFeeRevenue)}
                    </span>
                  </td>
                  <td>
                    {seller.ratingCount ? (
                      <>
                        <span className="font-semibold">
                          {seller.averageRating?.toFixed(1)} / 5
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          {formatMetric(seller.ratingCount)} ratings /{" "}
                          {formatMetric(seller.reviewCount)} reviews
                        </span>
                      </>
                    ) : (
                      "No ratings"
                    )}
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(seller.reportCount)} reports
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(seller.boostCount)} boosts bought
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.sellers.length === 0 ? (
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No sellers have enough activity to rank yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
