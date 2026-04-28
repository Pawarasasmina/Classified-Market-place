import Link from "next/link";
import { getListingsForCurrentUser } from "@/lib/phase1-data";

export default function MyListingsPage() {
  const myListings = getListingsForCurrentUser();

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Listing management
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
            Drafts, active listings, and owner actions for Phase 1.
          </h1>
        </div>
        <Link
          href="/sell"
          className="rounded-full bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-3 text-sm font-semibold text-white"
        >
          Create new listing
        </Link>
      </div>

      <div className="mt-8 grid gap-5">
        {myListings.map((listing) => (
          <section
            key={listing.id}
            className="grid gap-5 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6 xl:grid-cols-[0.18fr_0.55fr_0.27fr]"
          >
            <div
              className="h-36 rounded-[1.75rem]"
              style={{
                background: `linear-gradient(135deg, ${listing.imagePalette[0]}, ${listing.imagePalette[1]} 55%, ${listing.imagePalette[2]})`,
              }}
            />

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-[var(--foreground)]">
                  {listing.title}
                </h2>
                <span className="rounded-full bg-[rgba(31,107,90,0.1)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {listing.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {listing.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {listing.featureBullets.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--muted)]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div>
                <p className="display-font text-xl font-bold text-[var(--foreground)]">
                  {listing.priceLabel}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {listing.viewCount}
                </p>
              </div>
              <div className="grid gap-2">
                <Link
                  href={`/listings/${listing.id}`}
                  className="rounded-full bg-[var(--foreground)] px-4 py-3 text-center text-sm font-semibold text-[var(--surface)]"
                >
                  View listing
                </Link>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                >
                  Edit draft
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
