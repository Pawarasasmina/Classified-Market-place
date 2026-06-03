import Link from "next/link";
import { redirect } from "next/navigation";
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
      <section className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Boost tracking
          </p>
          <h1 className="mt-1 text-2xl font-bold">Active Boosted Listings</h1>
          <p className="mt-2 text-[var(--muted)]">
            Track live seller promotions and upcoming expiry windows.
          </p>
        </div>
        <Link
          href="/admin/boost-packages"
          className="action-secondary px-4 py-3 text-sm font-bold"
        >
          Manage packages
        </Link>
      </section>

      <div className="admin-table-wrap">
        <table className="admin-table">
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
              <tr key={boost.id}>
                <td>
                  <Link
                    href={`/listings/${boost.listing?.id ?? boost.listingId ?? ""}`}
                    className="font-semibold"
                  >
                    {boost.listing?.title ?? boost.listingId ?? boost.id}
                  </Link>
                </td>
                <td>{humanizeBoostPlacement(boost.placement)}</td>
                <td>
                  <span className="admin-status-badge">{boost.status}</span>
                </td>
                <td>{formatDate(boost.startsAt)}</td>
                <td>{formatDate(boost.endsAt)}</td>
                <td>{boost.transaction?.status ?? "Unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {boosts.length === 0 ? (
          <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
            No active boosted listings right now.
          </div>
        ) : null}
      </div>
    </div>
  );
}
