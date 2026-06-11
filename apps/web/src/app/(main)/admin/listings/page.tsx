import Link from "next/link";
import {
  moderateListingAction,
} from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminListingBulkTools } from "@/components/marketplace/admin-listing-bulk-tools";
import { DeleteAllListingsDialog } from "@/components/marketplace/delete-all-listings-dialog";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { AdminTablePagination } from "@/components/marketplace/admin-table-pagination";
import {
  buildAdminPaginationHref,
  getAdminPaginationHiddenFields,
  getAdminPaginationState,
  paginateAdminItems,
} from "@/lib/admin-pagination";
import { requireSessionContext } from "@/lib/auth-dal";
import { updateListingPriorityOverrideAction } from "../../actions";
import { fetchAdminListings } from "@/lib/marketplace-api";

type AdminListingsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    message?: string;
    moderation?: string;
    priority?: string;
    listingsBulk?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const listingStatusFilters = [
  "Active",
  "Pending",
  "Paused",
  "Rejected",
  "Deleted",
] as const;

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

function buildReturnTo(searchParams: Awaited<AdminListingsPageProps["searchParams"]>) {
  const params = new URLSearchParams();

  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.status) params.set("status", searchParams.status);
  if (searchParams.page) params.set("page", searchParams.page);
  if (searchParams.pageSize) params.set("pageSize", searchParams.pageSize);

  const query = params.toString();
  return query ? `/admin/listings?${query}` : "/admin/listings";
}

export default async function AdminListingsPage(props: AdminListingsPageProps) {
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/admin/listings");
  const listings = await fetchAdminListings(accessToken, { take: 1000 });
  const query = searchParams.q?.trim() ?? "";
  const status = listingStatusFilters.includes(
    searchParams.status as (typeof listingStatusFilters)[number],
  )
    ? searchParams.status
    : "";
  const filteredListings = listings.filter((listing) => {
    const matchesStatus = !status || listing.status === status;
    const searchable = [
      listing.title,
      listing.sellerDisplayName,
      listing.subcategory,
      listing.location,
      listing.priceLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || searchable.includes(query.toLowerCase());

    return matchesStatus && matchesQuery;
  });
  const pagination = getAdminPaginationState(
    searchParams,
    filteredListings.length,
  );
  const paginatedListings = paginateAdminItems(filteredListings, pagination);
  const paginationParams = {
    q: query,
    status,
    pageSize: pagination.pageSize,
  };
  const returnTo = buildReturnTo(searchParams);

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Seller operations"
        title="Admin listings"
        description="Moderate listing lifecycle changes, review paid submissions, and open seller records without leaving the listing queue."
        badge={`${filteredListings.length} shown`}
        actions={
          <Link
            href="/admin/reports/active-listings"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Active listings report
          </Link>
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

      <AdminActionFeedback
        status={searchParams.priority}
        message={searchParams.message}
        messages={{
          updated: "Listing priority updated.",
          invalid: "Check the priority fields and try again.",
        }}
        successStatuses={["updated"]}
      />

      <AdminActionFeedback
        status={searchParams.listingsBulk}
        message={searchParams.message}
        messages={{
          imported: "Listings bulk import finished.",
          importedPartial: "Listings bulk import finished with some failed rows.",
          importError: "We could not import the listing spreadsheet.",
          invalidImport: "Check the listing import file and try again.",
          deleted: "All listings were permanently deleted.",
          invalid: 'Type "DELETE ALL LISTINGS" exactly to continue.',
        }}
        successStatuses={["deleted", "imported"]}
        warningStatuses={["importedPartial"]}
      />

      <AdminListingBulkTools listings={listings} returnTo={returnTo} />
      <DeleteAllListingsDialog returnTo={returnTo} />

      <form className="panel admin-filter-bar grid gap-3 md:grid-cols-[1.5fr_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Search listings
          <input
            name="q"
            defaultValue={query}
            className="surface-input"
            placeholder="Title, seller, category, or location"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Status
          <select name="status" defaultValue={status} className="surface-input">
            <option value="">All statuses</option>
            {listingStatusFilters.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <AdminTableEnhancer
        tableId="admin-listings-table"
        copyLabel="listing IDs"
        stickyActions
      />
      <div className="admin-table-wrap">
        <table id="admin-listings-table" className="admin-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Seller</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Priority</th>
              <th>Boost</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedListings.map((listing) => {
              const currentStatus = listing.status.toUpperCase();
              const actions = ([
                "ACTIVE",
                "PAUSED",
                "REJECTED",
                "DELETED",
              ] as const).filter((status) => status !== currentStatus);

              return (
                <tr key={listing.id} data-row-id={listing.id}>
                  <td data-label="Listing">
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
                  <td data-label="Seller">
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
                  <td data-label="Status">
                    <span
                      className="admin-status-badge"
                      data-status={listing.status.toLowerCase()}
                    >
                      {listing.status}
                    </span>
                  </td>
                  <td data-label="Payment">
                    <p className="font-semibold">{listing.listingPaymentMode}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {listing.paidPriorityEnabled ? "Priority enabled" : "Standard priority"}
                    </p>
                  </td>
                  <td data-label="Priority">
                    <details className="grid gap-2">
                      <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
                        {listing.adminPriorityPinned
                          ? "Pinned"
                          : listing.adminPriorityPromoted
                            ? "Promoted"
                            : listing.adminPriorityScore != null
                              ? `Score ${listing.adminPriorityScore}`
                              : "Standard"}
                      </summary>
                      <form
                        action={updateListingPriorityOverrideAction}
                        className="grid min-w-[14rem] gap-2"
                      >
                        <input type="hidden" name="listingId" value={listing.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <label className="flex items-center gap-2 text-xs font-semibold">
                          <input
                            name="paid"
                            type="checkbox"
                            value="true"
                            defaultChecked={listing.paidPriorityEnabled}
                          />
                          Paid
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold">
                          <input
                            name="promoted"
                            type="checkbox"
                            value="true"
                            defaultChecked={listing.adminPriorityPromoted}
                          />
                          Promote
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold">
                          <input
                            name="pinned"
                            type="checkbox"
                            value="true"
                            defaultChecked={listing.adminPriorityPinned}
                          />
                          Pin
                        </label>
                        <input
                          name="score"
                          type="number"
                          min="0"
                          max="1000000"
                          defaultValue={listing.adminPriorityScore ?? ""}
                          className="surface-input text-xs"
                          placeholder="Priority score"
                        />
                        <input
                          name="startsAt"
                          type="datetime-local"
                          defaultValue={listing.adminPriorityStartsAt?.slice(0, 16)}
                          className="surface-input text-xs"
                        />
                        <input
                          name="expiresAt"
                          type="datetime-local"
                          defaultValue={listing.adminPriorityExpiresAt?.slice(0, 16)}
                          className="surface-input text-xs"
                        />
                        <AdminSubmitButton
                          className="admin-table-action"
                          pendingText="Saving..."
                        >
                          Save priority
                        </AdminSubmitButton>
                      </form>
                    </details>
                  </td>
                  <td data-label="Boost">
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
                  <td data-label="Actions">
                    <div className="admin-row-actions-grid">
                      {actions.map((status) => (
                        <form key={status} action={moderateListingAction} className="grid gap-2">
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input type="hidden" name="status" value={status} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          {status === "REJECTED" ? (
                            <textarea
                              name="reason"
                              rows={2}
                              placeholder="Reason for rejection"
                              className="surface-input min-w-[14rem] text-sm"
                            />
                          ) : null}
                          <AdminSubmitButton
                            className="admin-table-action"
                            confirmMessage={`${getActionLabel(
                              currentStatus,
                              status,
                            )} "${listing.title}"? This changes the listing status for customers and the seller.`}
                            pendingText="Updating..."
                          >
                            {getActionLabel(currentStatus, status)}
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
        {filteredListings.length === 0 ? (
          <div className="admin-empty-state">
            <p className="admin-empty-state-title">No listings found</p>
            <p className="admin-empty-state-copy">
              Try clearing the search text or status filter to return to the full moderation queue.
            </p>
          </div>
        ) : null}
      </div>
      {filteredListings.length > 0 ? (
        <AdminTablePagination
          buildPageHref={(page, pageSize = pagination.pageSize) =>
            buildAdminPaginationHref("/admin/listings", paginationParams, {
              page,
              pageSize,
            })
          }
          hiddenFields={getAdminPaginationHiddenFields(paginationParams)}
          itemLabel="listings"
          pagination={pagination}
        />
      ) : null}
    </div>
  );
}
