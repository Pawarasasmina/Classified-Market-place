import Link from "next/link";
import { requireAdminSession } from "@/lib/auth-dal";
import { fetchListings } from "@/lib/marketplace-api";
import { AdminPageHeader, AdminPanel, EmptyState, StatusBadge } from "@/components/marketplace/admin-ui";

type ListingsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function AdminListingsPage(props: ListingsPageProps) {
  const { accessToken } = await requireAdminSession("/admin/listings");
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const status = (searchParams.status ?? "ACTIVE").toUpperCase();

  const list = await fetchListings({
    search: q || undefined,
    status: status as "ACTIVE" | "DRAFT" | "SOLD" | "EXPIRED" | "REMOVED",
    take: 25,
  }, accessToken);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Listing Management"
        title="Manage listing lifecycle and quality."
        description="Filter by status, inspect listing metadata, and execute status operations from admin workflows."
      />

      <AdminPanel title="Filters">
        <form className="grid gap-3 md:grid-cols-[0.5fr_0.3fr_0.2fr]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title, category, seller, location"
            className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
          />
          <select
            name="status"
            defaultValue={status}
            className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
          >
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="SOLD">Sold</option>
            <option value="EXPIRED">Expired</option>
            <option value="REMOVED">Removed</option>
          </select>
          <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            Apply
          </button>
        </form>
      </AdminPanel>

      <AdminPanel title="Listings table" action={<span className="text-xs text-[var(--muted)]">{list.pagination.totalItems} items</span>}>
        {list.items.length ? (
          <div className="space-y-3">
            {list.items.map((listing) => (
              <div
                key={listing.id}
                className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{listing.title}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {listing.subcategory} • {listing.location} • {listing.priceLabel}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      listing.status.toLowerCase() === "active"
                        ? "active"
                        : listing.status.toLowerCase() === "draft"
                          ? "draft"
                          : listing.status.toLowerCase() === "sold"
                            ? "approved"
                            : listing.status.toLowerCase() === "removed"
                              ? "removed"
                              : "pending"
                    }
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/listings/${listing.id}`} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                    View details
                  </Link>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                    Edit status
                  </button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                    Remove listing
                  </button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                    Mark sold / expired
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No listings matched this filter." />
        )}
      </AdminPanel>
    </div>
  );
}
