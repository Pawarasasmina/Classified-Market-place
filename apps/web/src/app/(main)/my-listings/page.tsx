import Link from "next/link";
import { deleteListingAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchMyListings } from "@/lib/marketplace-api";

export default async function MyListingsPage() {
  const { accessToken } = await requireSessionContext("/my-listings");
  const listings = await fetchMyListings(accessToken);

  return (
    <div className="page grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Dashboard</h1>
          <p className="mt-2 text-slate-600">Manage your listings and moderation status.</p>
        </div>
        <Link href="/sell" className="action-primary px-4 py-2 text-sm font-semibold">
          Create listing
        </Link>
      </div>

      <div className="grid gap-3">
        {listings.length ? (
          listings.map((listing) => (
            <section key={listing.id} className="panel grid gap-4 md:grid-cols-[8rem_1fr_auto] md:items-center">
              <div className="h-28 overflow-hidden rounded-md bg-slate-100">
                {listing.imageUrls[0] ? (
                  <img src={listing.imageUrls[0]} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{listing.title}</h2>
                  <span className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold">
                    {listing.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{listing.priceLabel} · {listing.location}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{listing.description}</p>
              </div>
              <div className="grid gap-2">
                <Link href={`/listings/${listing.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-semibold">
                  View
                </Link>
                <Link href={`/listings/${listing.id}/edit`} className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-semibold">
                  Edit
                </Link>
                <form action={deleteListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700">
                    Delete
                  </button>
                </form>
              </div>
            </section>
          ))
        ) : (
          <div className="panel">You have not created any listings yet.</div>
        )}
      </div>
    </div>
  );
}
