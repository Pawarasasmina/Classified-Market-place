import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteSellerReviewAction,
  moderateSellerReviewAction,
} from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminSellerReviews } from "@/lib/marketplace-api";
import type { ApiSellerReviewStatus } from "@/lib/marketplace";

type AdminReviewsPageProps = {
  searchParams: Promise<{
    message?: string;
    status?: ApiSellerReviewStatus;
    updated?: string;
  }>;
};

const reviewStatuses: ApiSellerReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
];

function humanizeStatus(status: ApiSellerReviewStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function buildReturnTo(searchParams: Awaited<AdminReviewsPageProps["searchParams"]>) {
  const params = new URLSearchParams();

  if (searchParams.status) params.set("status", searchParams.status);

  const query = params.toString();
  return query ? `/admin/reviews?${query}` : "/admin/reviews";
}

export default async function AdminReviewsPage(props: AdminReviewsPageProps) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext("/admin/reviews");

  if (!hasAdminPermission(user.role, "REVIEWS_READ")) {
    redirect("/");
  }

  const canModerateReviews = hasAdminPermission(user.role, "REVIEWS_MODERATE");
  const status = reviewStatuses.includes(searchParams.status as ApiSellerReviewStatus)
    ? searchParams.status
    : "PENDING";
  const reviews = await fetchAdminSellerReviews(accessToken, { status });
  const returnTo = buildReturnTo(searchParams);
  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Trust and safety"
        title="Seller review moderation"
        description="Approve useful customer reviews and reject written feedback that violates marketplace standards, hide reviews, or delete review text while keeping the star rating."
        badge={`${reviews.length} ${humanizeStatus(status).toLowerCase()}`}
        actions={
          <Link
            href="/admin"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Back to dashboard
          </Link>
        }
      />

      <AdminActionFeedback
        status={searchParams.updated}
        message={searchParams.message}
        messages={{
          success: "Seller review moderation updated.",
          deleted: "Seller review deleted.",
        }}
        successStatuses={["success", "deleted"]}
      />

      <form className="panel admin-filter-bar grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Review status
          <select name="status" defaultValue={status} className="surface-input">
            {reviewStatuses.map((item) => (
              <option key={item} value={item}>
                {humanizeStatus(item)}
              </option>
            ))}
          </select>
        </label>
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <section className="grid gap-4">
        {reviews.length ? (
          reviews.map((review) => (
            <article key={review.id} className="panel grid gap-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">
                      {review.listing?.title ?? review.listingId}
                    </h2>
                    <span
                      className="admin-status-badge"
                      data-status={(review.reviewStatus ?? "PENDING").toLowerCase()}
                    >
                      {humanizeStatus(review.reviewStatus ?? "PENDING")}
                    </span>
                    <span className="admin-status-badge" data-status="success">
                      {review.stars} / 5 stars
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Seller {review.seller?.displayName ?? review.sellerId} /
                    Customer {review.rater?.displayName ?? review.raterId}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Updated {new Date(review.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="admin-row-actions">
                  <Link
                    href={`/listings/${review.listingId}?view=customer`}
                    target="_blank"
                    rel="noreferrer"
                    className="action-secondary h-fit px-3 py-2 text-center text-sm font-black"
                  >
                    Open listing
                  </Link>
                  <Link
                    href={`/sellers/${review.sellerId}?view=customer`}
                    target="_blank"
                    rel="noreferrer"
                    className="action-secondary h-fit px-3 py-2 text-center text-sm font-black"
                  >
                    Seller profile
                  </Link>
                </div>
              </div>

              <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                <p className="text-sm font-black">Customer review</p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                  {review.review}
                </p>
              </div>

              {review.reviewModerationNote ? (
                <div className="rounded-md border border-[var(--line)] bg-white p-4 text-sm">
                  <p className="font-black">Latest admin note</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {review.reviewModerationNote}
                  </p>
                </div>
              ) : null}

              {canModerateReviews ? (
                <>
                  <form
                    action={moderateSellerReviewAction}
                    className="admin-filter-bar grid gap-3 border-t border-[var(--line)] pt-4 lg:grid-cols-[12rem_1fr_auto] lg:items-end"
                  >
                    <input type="hidden" name="ratingId" value={review.id} />
                    <input type="hidden" name="sellerId" value={review.sellerId} />
                    <input type="hidden" name="listingId" value={review.listingId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="grid gap-2 text-sm font-bold">
                      Decision
                      <select
                        name="status"
                        defaultValue={review.reviewStatus ?? "PENDING"}
                        className="surface-input"
                      >
                        {reviewStatuses.map((item) => (
                          <option key={item} value={item}>
                            {humanizeStatus(item)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-bold">
                      Internal note
                      <input
                        name="note"
                        defaultValue={review.reviewModerationNote ?? ""}
                        className="surface-input"
                        placeholder="Optional moderation note"
                      />
                    </label>
                    <AdminSubmitButton
                      className="action-primary px-4 py-3 text-sm font-black"
                      pendingText="Saving decision..."
                    >
                      Save decision
                    </AdminSubmitButton>
                  </form>
                  <form
                    action={deleteSellerReviewAction}
                    className="admin-row-actions border-t border-[var(--line)] pt-4"
                  >
                    <input type="hidden" name="ratingId" value={review.id} />
                    <input type="hidden" name="sellerId" value={review.sellerId} />
                    <input type="hidden" name="listingId" value={review.listingId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <p className="text-sm text-[var(--muted)]">
                      Delete removes the written review only; the star rating
                      remains on the seller profile.
                    </p>
                    <AdminSubmitButton
                      className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100"
                      confirmMessage="Delete this written review text? The star rating will remain, but the review content will be removed."
                      pendingText="Deleting review..."
                    >
                      Delete review text
                    </AdminSubmitButton>
                  </form>
                </>
              ) : null}
            </article>
          ))
        ) : (
          <div className="panel admin-empty-state">
            <p className="admin-empty-state-title">No seller reviews found</p>
            <p className="admin-empty-state-copy">
              There are no seller reviews in this moderation status. Try another status filter.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
