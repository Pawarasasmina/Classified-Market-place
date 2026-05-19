import Link from "next/link";
import { boostListingAction, deleteListingAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import { boostPlans, fetchMyListings } from "@/lib/marketplace-api";

export default async function MyListingsPage() {
  const { accessToken } = await requireSessionContext("/my-listings");
  const listings = await fetchMyListings(accessToken);
  const activeCount = listings.filter((listing) => listing.status === "Active").length;
  const boostedCount = listings.filter((listing) => listing.isBoosted).length;

  return (
    <div className="page grid gap-6">
      <div className="panel-dark flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="section-eyebrow">Your selling activity</p>
          <h1 className="mt-2 text-3xl font-black text-white">My listings</h1>
          <p className="mt-2 text-[#d7d9ea]">
            Manage the items you post from this account and track moderation status.
          </p>
        </div>
        <Link
          href="/sell"
          className="rounded-md bg-white px-4 py-3 text-sm font-bold text-[var(--foreground)]"
        >
          Create listing
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total", listings.length],
          ["Active", activeCount],
          ["Boosted", boostedCount],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        {listings.length ? (
          listings.map((listing) => (
            <section
              key={listing.id}
              className="panel grid gap-4 md:grid-cols-[9rem_1fr_minmax(14rem,18rem)] md:items-center"
            >
              <div className="h-32 overflow-hidden rounded-md bg-[var(--surface-strong)]">
                {listing.imageUrls[0] ? (
                  <img src={listing.imageUrls[0]} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black">{listing.title}</h2>
                  <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-2 py-1 text-xs font-bold">
                    {listing.status}
                  </span>
                  {listing.isBoosted ? (
                    <span className="rounded-md border border-[var(--accent-strong)] bg-[var(--accent-soft)] px-2 py-1 text-xs font-black text-[var(--accent-strong)]">
                      Featured
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {listing.priceLabel} / {listing.location}
                </p>
                {listing.isBoosted ? (
                  <p className="mt-2 text-sm font-bold text-[var(--success)]">
                    Boost active: {listing.boostLabel}
                    {listing.boostEndsLabel ? ` / ${listing.boostEndsLabel}` : ""}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                  {listing.description}
                </p>
              </div>
              <div className="grid gap-2">
                <Link
                  href={
                    listing.status === "Active"
                      ? `/listings/${listing.id}`
                      : `/listings/${listing.id}/edit`
                  }
                  className="action-secondary px-3 py-2 text-center text-sm font-bold"
                >
                  {listing.status === "Active" ? "View" : "Review"}
                </Link>
                <Link
                  href={`/listings/${listing.id}/edit`}
                  className="action-secondary px-3 py-2 text-center text-sm font-bold"
                >
                  Edit
                </Link>
                {listing.status === "Active" && !listing.isBoosted ? (
                  <form action={boostListingAction} className="grid gap-2">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                      Boost plan
                      <select
                        name="placement"
                        defaultValue={boostPlans[0].placement}
                        className="surface-input rounded-md px-3 py-2 text-sm font-bold"
                      >
                        {boostPlans.map((plan) => (
                          <option key={plan.placement} value={plan.placement}>
                            {plan.label} / {plan.priceLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                      Duration
                      <select
                        name="durationDays"
                        defaultValue={String(boostPlans[0].durationDays)}
                        className="surface-input rounded-md px-3 py-2 text-sm font-bold"
                      >
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                      </select>
                    </label>
                    <button className="action-primary px-3 py-2 text-sm font-black">
                      Boost listing
                    </button>
                  </form>
                ) : listing.isBoosted ? (
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-bold text-[var(--success)]">
                    Active boost
                    {listing.boostEndsLabel ? (
                      <span className="block text-xs text-[var(--muted)]">
                        {listing.boostEndsLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <form action={deleteListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700">
                    Delete
                  </button>
                </form>
              </div>
            </section>
          ))
        ) : (
          <div className="panel">
            <h2 className="text-xl font-black">No listings yet.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Create your first listing to start appearing in marketplace search after review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
