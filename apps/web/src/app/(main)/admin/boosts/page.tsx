import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminActiveBoostedListings } from "@/lib/marketplace-api";
import { humanizeBoostPlacement } from "@/lib/marketplace";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminBoostsPage() {
  const { accessToken, user } = await requireSessionContext("/admin/boosts");

  if (!hasAdminPermission(user.role, "BOOSTS_READ")) {
    redirect("/");
  }

  const boosts = await fetchAdminActiveBoostedListings(accessToken);

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Boost tracking"
        title="Active Boosted Listings"
        description="Track live seller promotions and upcoming expiry windows."
        badge={`${boosts.length} active`}
        actions={
          <Link
            href="/admin/boost-packages"
            className="action-secondary px-4 py-3 text-sm font-bold"
          >
            Manage packages
          </Link>
        }
      />

      <AdminTableEnhancer tableId="admin-boosts-table" copyLabel="boost IDs" />
      <div className="admin-table-wrap">
        <table id="admin-boosts-table" className="admin-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Placement</th>
              <th>Status</th>
              <th>Starts</th>
              <th>Expires</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {boosts.map((boost) => (
              <tr key={boost.id} data-row-id={boost.id}>
                <td data-label="Listing">
                  <Link
                    href={`/listings/${boost.listing?.id ?? boost.listingId ?? ""}`}
                    className="font-semibold"
                  >
                    {boost.listing?.title ?? boost.listingId ?? boost.id}
                  </Link>
                </td>
                <td data-label="Placement">{humanizeBoostPlacement(boost.placement)}</td>
                <td data-label="Status">
                  <span
                    className="admin-status-badge"
                    data-status={boost.status.toLowerCase()}
                  >
                    {boost.status}
                  </span>
                </td>
                <td data-label="Starts">{formatDate(boost.startsAt)}</td>
                <td data-label="Expires">{formatDate(boost.endsAt)}</td>
                <td data-label="Payment">
                  <span
                    className="admin-status-badge"
                    data-status={boost.transaction?.status?.toLowerCase() ?? "none"}
                  >
                    {boost.transaction?.status ?? "Unknown"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {boosts.length === 0 ? (
          <div className="admin-empty-state">
            <p className="admin-empty-state-title">No active boosts</p>
            <p className="admin-empty-state-copy">
              Live seller promotions and upcoming expiry windows will appear here.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
