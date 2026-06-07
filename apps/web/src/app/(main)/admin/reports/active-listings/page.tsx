import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchActiveListingsReport } from "@/lib/marketplace-api";
import { humanizeBoostPlacement } from "@/lib/marketplace";

type ActiveListingsReportPageProps = {
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

function formatMoney(value: number, currency: string) {
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

export default async function ActiveListingsReportPage(
  props: ActiveListingsReportPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/active-listings",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports/active-listings?days=${selectedDays}`;
  const report = await fetchActiveListingsReport(accessToken, {
    days: selectedDays,
    take: 100,
  });
  const maxCategoryCount = Math.max(
    1,
    ...report.categories.map((category) => category.activeListings),
  );

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Listing report
          </p>
          <h1 className="mt-1 text-2xl font-bold">Active listings</h1>
          <p className="mt-2 text-[var(--muted)]">
            {formatDate(report.range.from)} to {formatDate(report.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="active-listings"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/active-listings?days=${days}`}
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
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Active listings", report.overview.activeListings, "live inventory"],
          ["Boosted", report.overview.boostedListings, "currently promoted"],
          ["Paid priority", report.overview.paidListings, "paid or priority"],
          ["No recent views", report.overview.noRecentViews, "needs attention"],
          ["Reported", report.overview.reportedListings, "with recent reports"],
          ["Categories", report.overview.categoriesRepresented, "represented"],
          ["Sellers", report.overview.sellersRepresented, "represented"],
          ["Pinned", report.overview.pinnedListings, "manual overrides"],
          [
            "Promoted",
            report.overview.manuallyPromotedListings,
            "admin priority",
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
              {formatMetric(Number(value))}
            </p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              {detail}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Engagement Health</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Recent activity across the active inventory.
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

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Category Breakdown</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Active listings grouped by category.
            </p>
          </div>
          <div className="grid gap-3">
            {report.categories.map((category) => (
              <div key={category.id} className="grid gap-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{category.name}</span>
                  <span className="font-bold">
                    {formatMetric(category.activeListings)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                  <div
                    className="h-2 rounded-full bg-[var(--brand)]"
                    style={{
                      width: barWidth(
                        category.activeListings,
                        maxCategoryCount,
                      ),
                    }}
                  />
                </div>
              </div>
            ))}
            {report.categories.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Active listing categories will appear here.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Active Listing Performance
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ranked by recent views, inquiries, active boosts, and title.
            </p>
          </div>
          <Link
            href="/admin"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Moderation dashboard
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Seller</th>
                <th>Priority</th>
                <th>Engagement</th>
                <th>Lifetime</th>
                <th>Risk</th>
                <th>Boost</th>
              </tr>
            </thead>
            <tbody>
              {report.listings.map((listing) => (
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
                      {listing.category.name} / {listing.location}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMoney(listing.price, listing.currency)} / Since{" "}
                      {formatDate(listing.createdAt)}
                    </span>
                  </td>
                  <td>
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
                  <td>
                    <span className="font-semibold">
                      {listing.listingPaymentMode === "PAID" ||
                      listing.paidPriorityEnabled
                        ? "Paid"
                        : "Organic"}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {listing.adminPriorityPinned
                        ? "Pinned"
                        : listing.adminPriorityPromoted
                          ? "Promoted"
                          : "No override"}
                      {listing.adminPriorityScore != null
                        ? ` / ${listing.adminPriorityScore}`
                        : ""}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(listing.viewCount)} views
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(listing.saveCount)} saves /{" "}
                      {formatMetric(listing.inquiryCount)} inquiries /{" "}
                      {listing.inquiryConversionRate}%
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(listing.lifetimeViewCount)} views
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(listing.lifetimeSaveCount)} saves /{" "}
                      {formatMetric(listing.lifetimeInquiryCount)} inquiries
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMetric(listing.reportCount)} recent
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatMetric(listing.lifetimeReportCount)} lifetime
                    </span>
                  </td>
                  <td>
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
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No active listings are currently available.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
