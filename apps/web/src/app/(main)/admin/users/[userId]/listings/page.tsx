import Link from "next/link";
import { redirect } from "next/navigation";
import { moderateListingAction } from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { AdminListingTools } from "@/components/marketplace/admin-listing-tools";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminUser,
  fetchAdminUserListings,
} from "@/lib/marketplace-api";

type AdminUserListingsPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{
    message?: string;
    moderation?: string;
  }>;
};

export default async function AdminUserListingsPage(
  props: AdminUserListingsPageProps
) {
  const [{ userId }, searchParams, session] = await Promise.all([
    props.params,
    props.searchParams,
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
      <AdminPageHeader
        eyebrow="User listings"
        title={managedUser.displayName}
        description="All listing statuses for this user are shown here."
        badge={`${listings.length} listings`}
        actions={
          <>
            <Link
              href={`/admin/users/${managedUser.id}`}
              className="action-secondary px-4 py-2 text-sm font-semibold"
            >
              User details
            </Link>
            <Link
              href={`/admin/users/${managedUser.id}/bookings`}
              className="action-primary px-4 py-2 text-sm font-semibold"
            >
              Bookings
            </Link>
          </>
        }
      />

      <AdminActionFeedback
        status={searchParams.moderation}
        message={searchParams.message}
        messages={{
          updated: "Listing moderation updated.",
          invalid: "Choose a listing and status before submitting.",
        }}
        successStatuses={["updated"]}
      />

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
        <AdminTableEnhancer
          tableId="admin-user-listings-table"
          copyLabel="listing IDs"
          stickyActions
        />
        <div className="admin-table-wrap">
          <table
            id="admin-user-listings-table"
            className="admin-table admin-user-listings-table"
          >
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
                  <tr key={listing.id} data-row-id={listing.id}>
                    <td className="admin-listing-cell" data-label="Listing">
                      <strong>{listing.title}</strong>
                      <span>
                        ID {listing.id.slice(0, 8)} / {listing.postedLabel}
                      </span>
                      <AdminListingTools listing={listing} />
                    </td>
                    <td data-label="Status">
                      <span
                        className="admin-status-badge"
                        data-status={listing.status.toLowerCase()}
                      >
                        {listing.status}
                      </span>
                    </td>
                    <td data-label="Category">{listing.subcategory}</td>
                    <td data-label="Location">{listing.location}</td>
                    <td data-label="Price">{listing.priceLabel}</td>
                    <td className="admin-actions-cell" data-label="Action">
                      <div>
                        {actions.map((status) => (
                          <form key={status} action={moderateListingAction}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="status" value={status} />
                            <input
                              type="hidden"
                              name="returnTo"
                              value={`/admin/users/${managedUser.id}/listings`}
                            />
                            <AdminSubmitButton
                              className="admin-table-action"
                              confirmMessage={`${
                                status === "ACTIVE"
                                  ? currentStatus === "PENDING"
                                    ? "Approve"
                                    : currentStatus === "PAUSED"
                                      ? "Show again"
                                      : "Activate"
                                  : status === "PAUSED"
                                    ? "Pause"
                                    : status === "REJECTED"
                                      ? "Reject"
                                      : "Delete"
                              } "${listing.title}"? This changes the listing status for customers and the seller.`}
                              data-intent={status.toLowerCase()}
                              pendingText="Updating..."
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
                            </AdminSubmitButton>
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
