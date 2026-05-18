import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminUserCard } from "@/components/marketplace/admin-user-card";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminUsers } from "@/lib/marketplace-api";

export default async function AdminUsersPage() {
  const { accessToken, user } = await requireSessionContext("/admin/users");

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const users = await fetchAdminUsers(accessToken);
  const admins = users.filter((item) => item.role.toUpperCase() === "ADMIN").length;
  const verifiedUsers = users.filter(
    (item) => item.emailVerified || item.phoneVerified
  ).length;
  const listingTotal = users.reduce(
    (total, item) => total + item.adminStats.totalListings,
    0
  );
  const bookingTotal = users.reduce(
    (total, item) => total + item.adminStats.bookingCount,
    0
  );

  return (
    <div className="admin-dashboard page">
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-kicker">Admin users</span>
          <h1>User Management</h1>
          <p>Review accounts, update access, and open each user&apos;s listings or bookings.</p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/admin" className="admin-panel-link">
            Dashboard
          </Link>
        </div>
      </section>

      <section className="admin-stat-grid" aria-label="User summary">
        {[
          ["Users", users.length],
          ["Admins", admins],
          ["Verified", verifiedUsers],
          ["Listings", listingTotal],
          ["Bookings", bookingTotal],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Current total</small>
          </div>
        ))}
      </section>

      <section className="admin-user-grid">
        {users.map((item) => (
          <AdminUserCard key={item.id} user={item} returnTo="/admin/users" />
        ))}
      </section>
    </div>
  );
}
