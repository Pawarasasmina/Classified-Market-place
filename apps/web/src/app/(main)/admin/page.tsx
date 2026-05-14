import Link from "next/link";
import { redirect } from "next/navigation";
import { moderateListingAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminCategories,
  fetchAdminListings,
} from "@/lib/marketplace-api";

export default async function AdminPage() {
  const { accessToken, user } = await requireSessionContext("/admin");

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const [categories, listings] = await Promise.all([
    fetchAdminCategories(accessToken),
    fetchAdminListings(accessToken, { take: 50 }),
  ]);
  const reviewQueue = listings.filter((listing) => listing.status === "Pending");
  const activeCount = listings.filter((listing) => listing.status === "Active").length;
  const rejectedCount = listings.filter((listing) => listing.status === "Rejected").length;
  const deletedCount = listings.filter((listing) => listing.status === "Deleted").length;
  const dashboardLinks = [
    {
      href: "/admin/categories",
      eyebrow: "Catalog",
      title: "Category Management",
      description: "Create, edit, disable, and organize category levels.",
      metric: categories.length,
      metricLabel: "categories",
    },
    {
      href: "#moderation",
      eyebrow: "Moderation",
      title: "Listing Review",
      description: "Approve, reject, or remove marketplace listings.",
      metric: reviewQueue.length,
      metricLabel: "pending",
    },
    {
      href: "/messages",
      eyebrow: "Support",
      title: "Support Inbox",
      description: "Open buyer, seller, and admin conversations.",
      metric: listings.length,
      metricLabel: "listings",
    },
  ];

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Admin workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">Dashboard</h1>
          <p className="mt-2 text-[var(--muted)]">
            Manage the marketplace without switching through customer pages.
          </p>
        </div>
        <Link
          href="/?view=customer"
          target="_blank"
          rel="noreferrer"
          className="action-primary px-4 py-2 text-sm font-semibold"
        >
          View customer view
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Pending", reviewQueue.length],
          ["Active", activeCount],
          ["Rejected", rejectedCount],
          ["Deleted", deletedCount],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {dashboardLinks.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="admin-dashboard-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
                  {item.eyebrow}
                </p>
                <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {item.description}
                </p>
              </div>
              <span className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                {item.metric} {item.metricLabel}
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section id="moderation" className="scroll-mt-24 grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Moderation Queue</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pending listings appear first; when the queue is empty, the latest listings are shown.
            </p>
          </div>
          <Link
            href="/admin/categories"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Manage categories
          </Link>
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
              {(reviewQueue.length ? reviewQueue : listings).map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <span className="font-semibold">{listing.title}</span>
                  </td>
                  <td>
                    <span className="admin-status-badge">{listing.status}</span>
                  </td>
                  <td>{listing.subcategory}</td>
                  <td>{listing.location}</td>
                  <td>{listing.priceLabel}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {(["ACTIVE", "REJECTED", "DELETED"] as const).map((status) => (
                        <form key={status} action={moderateListingAction}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input type="hidden" name="status" value={status} />
                          <button className="admin-table-action">
                            {status === "ACTIVE"
                              ? "Approve"
                              : status === "REJECTED"
                                ? "Reject"
                                : "Delete"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {listings.length === 0 ? (
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No listings are available for moderation.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
