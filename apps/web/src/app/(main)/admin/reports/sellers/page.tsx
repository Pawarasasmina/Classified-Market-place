import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminSellerReport } from "@/lib/marketplace-api";
import type { ApiSellerPriorityTier } from "@/lib/marketplace";

type AdminSellerReportPageProps = {
  searchParams: Promise<{
    days?: string;
    email?: string;
    message?: string;
  }>;
};

const dayOptions = [7, 30, 90, 180] as const;
const sellerTiers: ApiSellerPriorityTier[] = [
  "NONE",
  "AUTHORIZED",
  "VERIFIED",
  "VIP",
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDelta(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatMetric(Math.abs(value))}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminSellerReportPage(
  props: AdminSellerReportPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/sellers",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports/sellers?days=${selectedDays}`;
  const report = await fetchAdminSellerReport(accessToken, {
    days: selectedDays,
    take: 100,
  });

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Seller report
          </p>
          <h1 className="mt-1 text-2xl font-bold">Total sellers</h1>
          <p className="mt-2 text-[var(--muted)]">
            {formatDate(report.range.from)} to {formatDate(report.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="sellers"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/sellers?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
          <Link
            href="/admin/reports"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Operations report
          </Link>
          <Link
            href={`/admin/reports/seller-approvals?days=${selectedDays}`}
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Pending approvals
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Total sellers",
            formatMetric(report.overview.totalSellers),
            "users with listings",
          ],
          [
            "Active sellers",
            formatMetric(report.overview.activeSellers),
            `${report.overview.inactiveSellers} inactive`,
          ],
          [
            "New sellers",
            formatMetric(report.overview.newSellers),
            formatDelta(report.overview.newSellersDelta),
          ],
          [
            "Verified sellers",
            formatMetric(report.overview.verifiedSellers),
            `${report.overview.unverifiedSellers} unverified`,
          ],
          [
            "Tiered sellers",
            formatMetric(report.overview.tieredSellers),
            "authorized or above",
          ],
          [
            "VIP sellers",
            formatMetric(report.tiers.VIP ?? 0),
            "highest priority",
          ],
          [
            "Verified tier",
            formatMetric(report.tiers.VERIFIED ?? 0),
            "trusted priority",
          ],
          [
            "Authorized tier",
            formatMetric(report.tiers.AUTHORIZED ?? 0),
            "approved sellers",
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

      <section className="panel grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">Seller Tier Breakdown</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            All seller accounts grouped by priority tier.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {sellerTiers.map((tier) => (
            <div
              key={tier}
              className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-4"
            >
              <p className="text-sm text-[var(--muted)]">
                {humanizeLabel(tier)}
              </p>
              <p className="mt-2 text-3xl font-black">
                {formatMetric(report.tiers[tier] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Seller Performance</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ranked by active listings, then views and revenue.
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
                <th>Seller</th>
                <th>Tier</th>
                <th>Listings</th>
                <th>Engagement</th>
                <th>Ratings</th>
                <th>Revenue</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {report.sellers.map((seller) => (
                <tr key={seller.id}>
                  <td>
                    <Link
                      href={`/sellers/${seller.id}?view=customer`}
                      className="font-semibold"
                    >
                      {seller.displayName}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {seller.email}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {seller.emailVerified || seller.phoneVerified
                        ? "Verified contact"
                        : "Unverified contact"}
                    </span>
                  </td>
                  <td>{humanizeLabel(seller.sellerPriorityTier)}</td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(seller.totalListings)} total
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(seller.activeListings)} active /{" "}
                      {formatMetric(seller.newListings)} new /{" "}
                      {formatMetric(seller.paidListings)} paid
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(seller.viewCount)} views
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(seller.saveCount)} saves /{" "}
                      {formatMetric(seller.inquiryCount)} inquiries /{" "}
                      {seller.inquiryConversionRate}% conversion
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
                      {formatMoney(seller.revenue)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(seller.boostCount)} boosts
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(seller.reportCount)} reports
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Reputation {formatMetric(seller.reputationScore)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.sellers.length === 0 ? (
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No sellers have created listings yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
