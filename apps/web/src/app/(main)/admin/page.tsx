import { requireSessionContext } from "@/lib/auth-dal";
import { fetchListings } from "@/lib/marketplace-api";

export default async function AdminPage() {
  const { user } = await requireSessionContext("/admin");
  const [draftListings, activeListings] = await Promise.all([
    fetchListings({ status: "DRAFT", take: 8 }),
    fetchListings({ status: "ACTIVE", take: 4 }),
  ]);
  const reviewQueue = draftListings.length ? draftListings : activeListings;

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Admin moderation MVP
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Live listing review queue with moderation endpoints still pending.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          There is no dedicated moderation API yet, so this screen now reads live
          listings from the backend and surfaces draft inventory as the current
          review queue. Signed-in role: {user.role}.
        </p>
      </div>

      <div className="mb-6 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-5 text-sm text-[var(--muted)]">
        Approve and reject actions remain disabled until the backend exposes
        moderation routes. This page is now API-backed and ready for that handoff.
      </div>

      <div className="grid gap-4">
        {reviewQueue.length ? (
          reviewQueue.map((listing) => (
            <section
              key={listing.id}
              className="grid gap-5 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6 xl:grid-cols-[0.56fr_0.22fr_0.22fr]"
            >
              <div>
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  {listing.categorySlug || "uncategorized"}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {listing.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {listing.location} - {listing.postedLabel} - {listing.priceLabel}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Current status
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {listing.status}
                </p>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  disabled
                  className="rounded-full bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-[var(--surface)] opacity-60"
                >
                  Approve listing
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] opacity-60"
                >
                  Reject / remove
                </button>
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.7)] px-6 py-10 text-sm text-[var(--muted)]">
            No listings are currently available to review.
          </div>
        )}
      </div>
    </div>
  );
}
