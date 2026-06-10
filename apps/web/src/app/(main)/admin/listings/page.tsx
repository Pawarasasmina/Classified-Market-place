import Link from "next/link";
import { moderateListingAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminListings } from "@/lib/marketplace-api";

function getActionLabel(currentStatus: string, nextStatus: string) {
  if (nextStatus === "ACTIVE") {
    return currentStatus === "PENDING" ? "Approve" : "Activate";
  }

  if (nextStatus === "REJECTED") {
    return "Reject";
  }

  if (nextStatus === "PAUSED") {
    return "Pause";
  }

  return "Delete";
}

export default async function AdminListingsPage() {
  const { accessToken } = await requireSessionContext("/admin/listings");
  const listings = await fetchAdminListings(accessToken, { take: 100 });

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Admin listings</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Moderate listing lifecycle changes, review paid submissions, and open
          seller records without leaving the listing queue.
        </p>
      </div>

      <div className="panel overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-3 pr-4">Listing</th>
              <th className="py-3 pr-4">Seller</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Payment</th>
              <th className="py-3 pr-4">Boost</th>
              <th className="py-3 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => {
              const currentStatus = listing.status.toUpperCase();
              const actions = ([
                "ACTIVE",
                "PAUSED",
                "REJECTED",
                "DELETED",
              ] as const).filter((status) => status !== currentStatus);

              return (
                <tr key={listing.id} className="border-b border-[var(--line)] align-top">
                  <td className="py-4 pr-4">
                    {listing.status === "Active" ? (
                      <Link href={`/listings/${listing.id}`} className="font-bold">
                        {listing.title}
                      </Link>
                    ) : (
                      <span className="font-bold">{listing.title}</span>
                    )}
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {listing.subcategory} / {listing.location}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {listing.priceLabel}
                    </p>
                    {listing.rejectionReason ? (
                      <p className="mt-2 text-xs font-semibold text-[var(--brand-strong)]">
                        Rejection reason: {listing.rejectionReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-semibold">
                      {listing.sellerDisplayName ?? "Seller"}
                    </p>
                    <Link
                      href={`/admin/users/${listing.sellerId}`}
                      className="mt-2 inline-flex text-xs font-semibold text-[var(--brand)]"
                    >
                      Open seller
                    </Link>
                  </td>
                  <td className="py-4 pr-4">{listing.status}</td>
                  <td className="py-4 pr-4">
                    <p className="font-semibold">{listing.listingPaymentMode}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {listing.paidPriorityEnabled ? "Priority enabled" : "Standard priority"}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    {listing.isBoosted ? (
                      <>
                        <p className="font-semibold">{listing.boostLabel}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {listing.boostEndsLabel ?? "Boost active"}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">No active boost</span>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="grid gap-2">
                      {actions.map((status) => (
                        <form key={status} action={moderateListingAction} className="grid gap-2">
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input type="hidden" name="status" value={status} />
                          <input type="hidden" name="returnTo" value="/admin/listings" />
                          {status === "REJECTED" ? (
                            <textarea
                              name="reason"
                              rows={2}
                              placeholder="Reason for rejection"
                              className="surface-input min-w-[14rem] text-sm"
                            />
                          ) : null}
                          <button className="admin-table-action">
                            {getActionLabel(currentStatus, status)}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {listings.length === 0 ? (
          <div className="p-4 text-sm text-[var(--muted)]">
            No listings are available for moderation.
          </div>
        ) : null}
      </div>
    </div>
  );
}
