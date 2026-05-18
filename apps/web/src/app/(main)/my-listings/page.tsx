import Link from "next/link";
import {
  deleteListingAction,
  updateListingStatusAction,
} from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchMyListings } from "@/lib/marketplace-api";

export default async function MyListingsPage() {
  const { accessToken } = await requireSessionContext("/my-listings");
  const listings = await fetchMyListings(accessToken);
  const activeCount = listings.filter((listing) => listing.status === "Active").length;
  const pendingCount = listings.filter((listing) => listing.status === "Pending").length;
  const draftCount = listings.filter((listing) => listing.status === "Draft").length;

  return (
    <div className="page grid gap-6">
      <div className="panel-dark flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="section-eyebrow">Seller dashboard</p>
          <h1 className="mt-2 text-3xl font-black text-white">My listings</h1>
          <p className="mt-2 text-[#d7d9ea]">
            Manage your inventory and moderation status.
          </p>
        </div>
        <Link
          href="/sell"
          className="rounded-md bg-white px-4 py-3 text-sm font-bold text-[var(--foreground)]"
        >
          Create listing
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Total", listings.length],
          ["Active", activeCount],
          ["Pending", pendingCount],
          ["Drafts", draftCount],
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
              className="panel grid gap-4 md:grid-cols-[9rem_1fr_auto] md:items-center"
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
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {listing.priceLabel} / {listing.location}
                </p>
                {listing.expiresAt && listing.status === "Active" ? (
                  <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                    Expires {new Date(listing.expiresAt).toLocaleDateString()}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                  {listing.description}
                </p>
              </div>
              <div className="grid gap-2">
                {listing.status !== "Draft" && listing.status !== "Removed" ? (
                  <Link
                    href={`/listings/${listing.id}`}
                    className="action-secondary px-3 py-2 text-center text-sm font-bold"
                  >
                    View
                  </Link>
                ) : null}
                <Link
                  href={`/listings/${listing.id}/edit`}
                  className="action-secondary px-3 py-2 text-center text-sm font-bold"
                >
                  Edit
                </Link>
                {listing.status === "Active" || listing.status === "Paused" ? (
                  <form action={updateListingStatusAction}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="status" value="SOLD" />
                    <button className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">
                      Mark sold
                    </button>
                  </form>
                ) : null}
                {listing.status !== "Removed" && listing.status !== "Deleted" ? (
                  <form action={updateListingStatusAction}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="status" value="REMOVED" />
                    <button className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700">
                      Remove
                    </button>
                  </form>
                ) : null}
                <form action={deleteListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700">
                    Delete permanently
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
