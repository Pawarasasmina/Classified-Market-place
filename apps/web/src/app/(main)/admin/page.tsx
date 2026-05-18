import Link from "next/link";
import { redirect } from "next/navigation";
import { moderateListingAction } from "@/app/(main)/actions";
import { AdminListingTools } from "@/components/marketplace/admin-listing-tools";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminCategories,
  fetchAdminListings,
  fetchAdminUsers,
} from "@/lib/marketplace-api";

export default async function AdminPage() {
  const { accessToken, user } = await requireSessionContext("/admin");

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const [categories, listings, users] = await Promise.all([
    fetchAdminCategories(accessToken),
    fetchAdminListings(accessToken, { take: 50 }),
    fetchAdminUsers(accessToken),
  ]);
  const reviewQueue = listings.filter((listing) => listing.status === "Pending");
  const activeCount = listings.filter((listing) => listing.status === "Active").length;
  const pausedCount = listings.filter((listing) => listing.status === "Paused").length;
  const rejectedCount = listings.filter((listing) => listing.status === "Rejected").length;
  const deletedCount = listings.filter((listing) => listing.status === "Deleted").length;
  const visibleListings = reviewQueue.length ? reviewQueue : listings;
  const statCards = [
    {
      label: "Pending",
      value: reviewQueue.length,
      note: "Need review",
      tone: "pending",
    },
    {
      label: "Active",
      value: activeCount,
      note: "Live listings",
      tone: "active",
    },
    {
      label: "Paused",
      value: pausedCount,
      note: "Hidden by admin",
      tone: "paused",
    },
    {
      label: "Rejected",
      value: rejectedCount,
      note: "Declined",
      tone: "rejected",
    },
    {
      label: "Deleted",
      value: deletedCount,
      note: "Removed",
      tone: "deleted",
    },
  ];
  const dashboardLinks = [
    {
      href: "/admin/categories",
      eyebrow: "Catalog",
      title: "Category Management",
      description: "Create, edit, disable, and organize category levels.",
      metric: categories.length,
      metricLabel: "categories",
      cta: "Manage catalog",
    },
    {
      href: "#moderation",
      eyebrow: "Moderation",
      title: "Listing Review",
      description: "Approve, reject, or remove marketplace listings.",
      metric: reviewQueue.length,
      metricLabel: "pending",
      cta: "Review queue",
    },
    {
      href: "/messages",
      eyebrow: "Support",
      title: "Support Inbox",
      description: "Open buyer, seller, and admin conversations.",
      metric: listings.length,
      metricLabel: "listings",
      cta: "Open inbox",
    },
    {
      href: "/admin/users",
      eyebrow: "Users",
      title: "User Management",
      description: "Manage accounts, listings, and booking activity.",
      metric: users.length,
      metricLabel: "users",
      cta: "Manage users",
    },
  ];

  return (
    <div className="admin-dashboard page">
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-kicker">Admin workspace</span>
          <h1>Dashboard</h1>
          <p>Manage categories, listings, and support from one compact view.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-health-pill">System active</span>
          <Link
            href="/?view=customer"
            target="_blank"
            rel="noreferrer"
            className="admin-primary-link"
          >
            View customer view
          </Link>
        </div>
      </section>

      <section className="admin-stat-grid" aria-label="Listing summary">
        {statCards.map((item) => (
          <div key={item.label} className="admin-stat-card" data-tone={item.tone}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </div>
        ))}
      </section>

      <section className="admin-action-grid" aria-label="Admin actions">
        {dashboardLinks.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="admin-dashboard-card"
          >
            <div>
              <span className="admin-kicker">{item.eyebrow}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
            <div className="admin-card-footer">
              <span>
                {item.metric} {item.metricLabel}
              </span>
              <strong>{item.cta}</strong>
            </div>
          </Link>
        ))}
      </section>

      <section id="moderation" className="admin-management-panel scroll-mt-24">
        <div className="admin-panel-header">
          <div>
            <span className="admin-kicker">Moderation</span>
            <h2>Listing Queue</h2>
            <p>
              Pending listings appear first; when the queue is empty, the latest listings are shown.
            </p>
          </div>
          <div className="admin-panel-actions">
            <span>{visibleListings.length} shown</span>
            <Link href="/admin/categories">Manage categories</Link>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
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
              {visibleListings.map((listing) => {
                const currentStatus = listing.status.toUpperCase();
                const actions = ([
                  "ACTIVE",
                  "PAUSED",
                  "REJECTED",
                  "DELETED",
                ] as const).filter(
                  (status) => status !== currentStatus
                );

                return (
                  <tr key={listing.id}>
                    <td className="admin-listing-cell">
                      <strong>{listing.title}</strong>
                      <span>ID {listing.id.slice(0, 8)}</span>
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
            <div className="admin-empty-state">
              No listings are available for moderation.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
