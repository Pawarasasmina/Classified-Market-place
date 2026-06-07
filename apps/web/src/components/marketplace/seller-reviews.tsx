import Link from "next/link";
import type { ApiSellerRating } from "@/lib/marketplace";

export function SellerReviews({
  reviews,
  title = "Customer reviews",
  emptyMessage = "No written customer reviews yet.",
}: {
  reviews: ApiSellerRating[];
  title?: string;
  emptyMessage?: string;
}) {
  const writtenReviews = reviews.filter((review) => review.review);

  return (
    <section className="panel p-5">
      <p className="section-eyebrow">Seller feedback</p>
      <h2 className="mt-2 text-xl font-black">{title}</h2>
      {writtenReviews.length ? (
        <div className="mt-4 grid gap-3">
          {writtenReviews.map((review) => (
            <article
              key={review.id}
              className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">
                  {review.rater?.displayName ?? "Customer"} / {review.stars} out
                  of 5
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {new Date(review.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                {review.review}
              </p>
              {review.listing ? (
                <Link
                  href={`/listings/${review.listing.id}`}
                  className="mt-3 inline-block text-xs font-bold text-[var(--brand-strong)]"
                >
                  Review for {review.listing.title}
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">{emptyMessage}</p>
      )}
    </section>
  );
}
