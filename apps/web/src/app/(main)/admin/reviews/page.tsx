import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteSellerReviewAction,
  moderateSellerReviewAction,
} from "@/app/(main)/actions";
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
  const updateMessage =
    searchParams.updated === "success"
      ? "Seller review moderation updated."
      : searchParams.updated === "deleted"
        ? "Seller review deleted."
      : searchParams.updated === "error"
        ? (searchParams.message ?? "Could not update that seller review.")
        : null;

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Trust and safety
          </p>
          <h1 className="mt-1 text-2xl font-bold">Seller review moderation</h1>
          <p className="mt-2 text-[var(--muted)]">
            Approve useful customer reviews and reject written feedback that
            violates marketplace standards, hide reviews, or delete review
            text while keeping the star rating.
          </p>
        </div>
        <Link
          href="/admin"
          className="action-secondary px-4 py-2 text-sm font-semibold"
        >
          Back to dashboard
        </Link>
      </div>

      {updateMessage ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm font-semibold ${
            searchParams.updated === "success" ||
            searchParams.updated === "deleted"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {updateMessage}
        </div>
      ) : null}

      <form className="panel grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
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
                    <span className="admin-status-badge">
                      {humanizeStatus(review.reviewStatus ?? "PENDING")}
                    </span>
                    <span className="admin-status-badge">
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
                <div className="flex flex-wrap gap-2 lg:justify-end">
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
                    className="grid gap-3 border-t border-[var(--line)] pt-4 lg:grid-cols-[12rem_1fr_auto] lg:items-end"
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
                    <button className="action-primary px-4 py-3 text-sm font-black">
                      Save decision
                    </button>
                  </form>
                  <form
                    action={deleteSellerReviewAction}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4"
                  >
                    <input type="hidden" name="ratingId" value={review.id} />
                    <input type="hidden" name="sellerId" value={review.sellerId} />
                    <input type="hidden" name="listingId" value={review.listingId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <p className="text-sm text-[var(--muted)]">
                      Delete removes the written review only; the star rating
                      remains on the seller profile.
                    </p>
                    <button className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100">
                      Delete review text
                    </button>
                  </form>
                </>
              ) : null}
            </article>
          ))
        ) : (
          <div className="panel text-sm text-[var(--muted)]">
            No seller reviews match this moderation status.
          </div>
        )}
      </section>
    </div>
  );
}
