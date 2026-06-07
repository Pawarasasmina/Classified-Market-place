export function SellerRatingSummary({
  averageRating,
  ratingCount,
  reviewCount,
  className = "",
}: {
  averageRating: number | null;
  ratingCount: number;
  reviewCount?: number;
  className?: string;
}) {
  const reviewLabel =
    reviewCount === undefined
      ? ""
      : `, ${reviewCount} written ${
          reviewCount === 1 ? "review" : "reviews"
        }`;
  const label =
    ratingCount > 0 && averageRating != null
      ? `Rating: ${averageRating.toFixed(1)} / 5 (${ratingCount} ${
          ratingCount === 1 ? "rating" : "ratings"
        }${reviewLabel})`
      : `No customer ratings yet${reviewCount === undefined ? "" : " (0 written reviews)"}`;

  return <p className={className}>{label}</p>;
}

export function SellerRatingSummaryCard({
  averageRating,
  ratingCount,
  reviewCount,
  reputationScore,
}: {
  averageRating: number | null;
  ratingCount: number;
  reviewCount: number;
  reputationScore: number;
}) {
  const averageLabel =
    ratingCount > 0 && averageRating != null
      ? averageRating.toFixed(1)
      : "New";
  const summaryLabel =
    ratingCount > 0 && averageRating != null
      ? `${averageRating.toFixed(1)} out of 5 from customers`
      : "No customer ratings yet";

  return (
    <section className="panel p-5">
      <p className="section-eyebrow">Rating summary</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[12rem_1fr] lg:items-center">
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-5 text-center">
          <p className="text-5xl font-black text-[var(--foreground)]">
            {averageLabel}
          </p>
          <p className="mt-2 text-sm font-bold text-[var(--muted)]">
            {summaryLabel}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--muted)]">Total ratings</p>
            <p className="mt-2 text-2xl font-black">{ratingCount}</p>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--muted)]">Written reviews</p>
            <p className="mt-2 text-2xl font-black">{reviewCount}</p>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--muted)]">Reputation score</p>
            <p className="mt-2 text-2xl font-black">{reputationScore}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
