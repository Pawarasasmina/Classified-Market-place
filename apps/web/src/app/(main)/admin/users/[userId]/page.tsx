import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminUserCard } from "@/components/marketplace/admin-user-card";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminUser } from "@/lib/marketplace-api";

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage(
  props: AdminUserDetailPageProps
) {
  const [{ userId }, session] = await Promise.all([
    props.params,
    requireSessionContext("/admin/users"),
  ]);
  const { accessToken, user } = session;

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const managedUser = await fetchAdminUser(accessToken, userId);

  return (
    <div className="admin-dashboard page">
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-kicker">User details</span>
          <h1>{managedUser.displayName}</h1>
          <p>{managedUser.email}</p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/admin/users" className="admin-panel-link">
            All users
          </Link>
          <Link
            href={`/admin/users/${managedUser.id}/listings`}
            className="admin-primary-link"
          >
            User listings
          </Link>
          <Link
            href={`/admin/users/${managedUser.id}/bookings`}
            className="admin-primary-link"
          >
            User bookings
          </Link>
        </div>
      </section>

      <section className="admin-stat-grid" aria-label="User detail summary">
        {[
          ["Listings", managedUser.adminStats.totalListings],
          ["Active", managedUser.adminStats.activeListings],
          ["Paused", managedUser.adminStats.pausedListings],
          ["Pending", managedUser.adminStats.pendingListings],
          ["Bookings", managedUser.adminStats.bookingCount],
          ["Offers", managedUser.adminStats.offerCount],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>For this user</small>
          </div>
        ))}
      </section>

      <AdminUserCard
        user={managedUser}
        returnTo={`/admin/users/${managedUser.id}`}
        expanded
      />
    </div>
  );
}
