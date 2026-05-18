import Link from "next/link";
import { redirect } from "next/navigation";
import { moderateListingAction } from "@/app/(main)/actions";
import { AdminListingTools } from "@/components/marketplace/admin-listing-tools";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminUser,
  fetchAdminUserListings,
} from "@/lib/marketplace-api";

type AdminUserListingsPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserListingsPage(
  props: AdminUserListingsPageProps
) {
  const [{ userId }, session] = await Promise.all([
    props.params,
    requireSessionContext("/admin/users"),
  ]);
  const { accessToken, user } = session;

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const [managedUser, listings] = await Promise.all([
    fetchAdminUser(accessToken, userId),
    fetchAdminUserListings(accessToken, userId),
  ]);

  return (
    <div className="admin-dashboard page">
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-kicker">User listings</span>
          <h1>{managedUser.displayName}</h1>
          <p>{listings.length} listings under this account.</p>
        </div>
        <div className="admin-hero-actions">
          <Link href={`/admin/users/${managedUser.id}`} className="admin-panel-link">
            User details
          </Link>
          <Link
            href={`/admin/users/${managedUser.id}/bookings`}
            className="admin-primary-link"
          >
            Bookings
          </Link>
        </div>
      </section>

      <section className="admin-management-panel">
        <div className="admin-panel-header">
          <div>
            <span className="admin-kicker">Inventory</span>
            <h2>Listings</h2>
            <p>All listing statuses for this user are shown here.</p>
          </div>
          <div className="admin-panel-actions">
            <span>{listings.length} shown</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table admin-user-listings-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Status</th>
                <th>Category</th>
                <th>Location</th>
                <th>Price</th>
                <th>Action</th>
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
                  <tr key={listing.id}>
                    <td className="admin-listing-cell">
                      <strong>{listing.title}</strong>
                      <span>
                        ID {listing.id.slice(0, 8)} / {listing.postedLabel}
                      </span>
                      <AdminListingTools listing={listing} />
                    </td>
                    <td>
                      <span
                        className="admin-status-badge"
                        data-status={listing.status.toLowerCase()}
                      >
                        {listing.status}
                      </span>
                    </td>
                    <td>{listing.subcategory}</td>
                    <td>{listing.location}</td>
                    <td>{listing.priceLabel}</td>
                    <td className="admin-actions-cell">
                      <div>
                        {actions.map((status) => (
                          <form key={status} action={moderateListingAction}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="status" value={status} />
                            <button
                              className="admin-table-action"
                              data-intent={status.toLowerCase()}
                            >
                              {status === "ACTIVE"
                                ? currentStatus === "PENDING"
                                  ? "Approve"
                                  : currentStatus === "PAUSED"
                                    ? "Show again"
                                    : "Activate"
                                : status === "PAUSED"
                                  ? "Pause"
                                  : status === "REJECTED"
                                    ? "Reject"
                                    : "Delete"}
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
            <div className="admin-empty-state">No listings found for this user.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
