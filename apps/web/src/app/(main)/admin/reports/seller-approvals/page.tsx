import Link from "next/link";
import { redirect } from "next/navigation";
import { updateAdminUserAction } from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchPendingSellerApprovalsReport } from "@/lib/marketplace-api";
import type { ApiSellerPriorityTier } from "@/lib/marketplace";

type PendingSellerApprovalsPageProps = {
  searchParams: Promise<{
    days?: string;
    email?: string;
    message?: string;
    user?: string;
  }>;
};

const dayOptions = [7, 30, 90, 180] as const;
const approvalTiers: Exclude<ApiSellerPriorityTier, "NONE">[] = [
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

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function PendingSellerApprovalsPage(
  props: PendingSellerApprovalsPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/seller-approvals",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const canApproveSellers = hasAdminPermission(user.role, "USERS_WRITE");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const report = await fetchPendingSellerApprovalsReport(accessToken, {
    days: selectedDays,
    take: 100,
  });
  const returnTo = `/admin/reports/seller-approvals?days=${selectedDays}`;

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Seller approvals"
        title="Pending seller approvals"
        description="Sellers with listings who are still waiting for an approval tier."
        badge={`${report.overview.pendingApprovals} pending`}
        actions={
          <>
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="seller-approvals"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/seller-approvals?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
          <Link
            href="/admin/reports/sellers"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Total sellers
          </Link>
          </>
        }
      />

      <AdminActionFeedback
        status={searchParams.user}
        message={searchParams.message}
        messages={{
          updated: "Seller approval tier saved.",
          invalid: "Choose an approval tier before submitting.",
        }}
        successStatuses={["updated"]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Pending approvals",
            report.overview.pendingApprovals,
            "NONE tier sellers",
          ],
          [
            "Verified pending",
            report.overview.verifiedPending,
            "email or phone",
          ],
          [
            "Needs verification",
            report.overview.needsContactVerification,
            "missing contact proof",
          ],
          [
            "Active pending",
            report.overview.activePending,
            "with active listings",
          ],
          [
            "High-signal",
            report.overview.highSignalApprovals,
            "ready to review first",
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

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Approval Queue</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Candidates are sorted by verified contact, active inventory,
              views, and oldest account first.
            </p>
          </div>
          <Link
            href="/admin/users"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Manage all users
          </Link>
        </div>

        <div className="grid gap-4">
          {report.approvals.map((seller) => (
            <article key={seller.id} className="panel grid gap-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black">{seller.displayName}</h3>
                    <span className="admin-status-badge">
                      {seller.verifiedContact
                        ? "Verified contact"
                        : "Needs verification"}
                    </span>
                    {seller.reportCount > 0 ? (
                      <span className="admin-status-badge">
                        {formatMetric(seller.reportCount)} reports
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {seller.email} / {seller.phone ?? "No phone"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    First listing {formatDate(seller.firstListingAt)} / Latest{" "}
                    {formatDate(seller.latestListingAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <Link
                    href={`/sellers/${seller.id}?view=customer`}
                    target="_blank"
                    rel="noreferrer"
                    className="action-secondary px-3 py-2 text-sm font-semibold"
                  >
                    Seller profile
                  </Link>
                  {seller.latestListing ? (
                    <Link
                      href={`/listings/${seller.latestListing.id}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="action-secondary px-3 py-2 text-sm font-semibold"
                    >
                      Latest listing
                    </Link>
                  ) : null}
                </div>
              </div>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  [
                    "Listings",
                    `${seller.totalListings}`,
                    `${seller.activeListings} active / ${seller.pendingListings} pending`,
                  ],
                  [
                    "Engagement",
                    `${seller.viewCount}`,
                    `${seller.saveCount} saves / ${seller.inquiryCount} inquiries`,
                  ],
                  [
                    "Conversion",
                    `${seller.inquiryConversionRate}%`,
                    "inquiries from views",
                  ],
                  [
                    "Ratings",
                    seller.ratingCount
                      ? `${seller.averageRating?.toFixed(1)} / 5`
                      : "None",
                    `${seller.ratingCount} ratings / ${seller.reviewCount} reviews`,
                  ],
                  [
                    "Revenue",
                    formatMoney(seller.revenue),
                    `${seller.boostCount} boosts`,
                  ],
                  ["Reputation", `${seller.reputationScore}`, "current score"],
                ].map(([label, value, detail]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-black">{value}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
                  </div>
                ))}
              </section>

              {seller.latestListing ? (
                <div className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-4 text-sm">
                  <p className="font-black">Latest listing</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {seller.latestListing.title} /{" "}
                    {seller.latestListing.categoryName ?? "Uncategorized"} /{" "}
                    {humanizeLabel(seller.latestListing.status)}
                  </p>
                </div>
              ) : null}

              {canApproveSellers ? (
                <form
                  action={updateAdminUserAction}
                  className="grid gap-3 border-t border-[var(--line)] pt-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
                >
                  <input type="hidden" name="userId" value={seller.id} />
                  <input type="hidden" name="name" value={seller.displayName} />
                  <input type="hidden" name="phone" value={seller.phone ?? ""} />
                  <input type="hidden" name="role" value="USER" />
                  <input
                    type="hidden"
                    name="isEmailVerified"
                    value={seller.emailVerified ? "true" : "false"}
                  />
                  <input
                    type="hidden"
                    name="isPhoneVerified"
                    value={seller.phoneVerified ? "true" : "false"}
                  />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label className="grid gap-2 text-sm font-bold">
                    Approval tier
                    <select
                      name="sellerPriorityTier"
                      defaultValue={
                        seller.verifiedContact ? "VERIFIED" : "AUTHORIZED"
                      }
                      className="surface-input"
                    >
                      {approvalTiers.map((tier) => (
                        <option key={tier} value={tier}>
                          {humanizeLabel(tier)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-lg border border-[var(--line)] bg-[rgba(8,13,29,0.42)] p-3 text-sm text-[var(--muted)]">
                    Approval moves the seller out of this queue and unlocks
                    their selected priority tier in search ranking.
                  </div>
                  <AdminSubmitButton
                    className="action-primary px-4 py-3 text-sm font-black"
                    confirmMessage={`Approve ${seller.displayName} for the selected seller tier?`}
                    pendingText="Approving seller..."
                  >
                    Approve seller
                  </AdminSubmitButton>
                </form>
              ) : null}
            </article>
          ))}

          {report.approvals.length === 0 ? (
            <div className="admin-empty-state panel">
              <p className="admin-empty-state-title">
                No pending seller approvals
              </p>
              <p className="admin-empty-state-copy">
                Sellers with listings and no approval tier will appear here.
              </p>
              <Link
                href="/admin/users"
                className="action-secondary px-3 py-2 text-sm font-semibold"
              >
                Manage users
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
