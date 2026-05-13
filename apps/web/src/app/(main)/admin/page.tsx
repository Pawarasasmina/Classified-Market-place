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

  return (
    <div className="page grid gap-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="mt-2 text-[var(--muted)]">
          Manage categories and moderate listings.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/categories"
          className="rounded-md border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
                Catalog
              </p>
              <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                Category Management
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Manage category, subcategory, and sub-subcategory tree.
              </p>
            </div>
            <span className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
              {categories.length}
            </span>
          </div>
        </Link>

        <div className="rounded-md border border-[var(--line)] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Moderation
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            Listing Review
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Review pending, active, rejected, and deleted listings.
          </p>
          <span className="mt-4 inline-flex rounded-md bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
            {reviewQueue.length} pending
          </span>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">Moderation Queue</h2>
        <div className="grid gap-3">
          {(reviewQueue.length ? reviewQueue : listings).map((listing) => (
            <div
              key={listing.id}
              className="panel grid gap-4 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{listing.title}</h3>
                  <span className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold">
                    {listing.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {listing.priceLabel} / {listing.location} /{" "}
                  {listing.subcategory}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["ACTIVE", "REJECTED", "DELETED"] as const).map((status) => (
                  <form key={status} action={moderateListingAction}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="status" value={status} />
                    <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:border-[var(--brand)] hover:text-[var(--brand-strong)]">
                      {status === "ACTIVE"
                        ? "Approve"
                        : status === "REJECTED"
                          ? "Reject"
                          : "Delete"}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
