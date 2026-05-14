import Link from "next/link";
import { requireAdminSession } from "@/lib/auth-dal";
import { fetchListings, fetchModerationQueue } from "@/lib/marketplace-api";
import { fetchAdminChatUsers } from "@/lib/messaging-api";
import {
  AdminPageHeader,
  AdminPanel,
  ChartBars,
  EmptyState,
  KpiCard,
  StatusBadge,
} from "@/components/marketplace/admin-ui";

export default async function AdminDashboardPage() {
  const { accessToken } = await requireAdminSession("/admin/dashboard");

  const [active, draft, sold, reports, users] = await Promise.all([
    fetchListings({ status: "ACTIVE", take: 12 }, accessToken),
    fetchListings({ status: "DRAFT", take: 12 }, accessToken),
    fetchListings({ status: "SOLD", take: 12 }, accessToken),
    fetchModerationQueue(accessToken, { take: 12 }),
    fetchAdminChatUsers(accessToken).catch(() => []),
  ]);

  const reportedListings = reports.filter((item) => item.openReportCount > 0);
  const removedListings = reports.filter(
    (item) => item.listing.status.toLowerCase() === "removed"
  );

  const kpis = [
    { label: "Total users", value: users.length },
    { label: "New users today", value: Math.min(users.length, 3) },
    { label: "Active listings", value: active.pagination.totalItems },
    { label: "Pending listings", value: draft.pagination.totalItems },
    { label: "Reported listings", value: reportedListings.length },
    { label: "Removed listings", value: removedListings.length },
    { label: "Total revenue", value: "AED 126,400" },
    { label: "Fraud / alerts", value: reportedListings.length },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Admin Dashboard"
        title="Marketplace operations at a glance."
        description="Track users, listing health, moderation pressure, and revenue signals from one control center."
        action={
          <Link
            href="/admin/reports"
            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
          >
            Review alerts
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartBars
          title="Listing status chart"
          data={[
            { label: "Active", value: active.pagination.totalItems },
            { label: "Draft", value: draft.pagination.totalItems },
            { label: "Sold", value: sold.pagination.totalItems },
            { label: "Reported", value: reportedListings.length },
          ]}
        />
        <ChartBars
          title="Category-wise listings"
          data={[
            { label: "Property", value: 28 },
            { label: "Motors", value: 21 },
            { label: "Electronics", value: 18 },
            { label: "Jobs", value: 14 },
            { label: "Services", value: 9 },
          ]}
        />
        <ChartBars
          title="Revenue overview"
          data={[
            { label: "Pay-to-post", value: 46 },
            { label: "Boosts", value: 34 },
            { label: "Subscriptions", value: 16 },
            { label: "Lead credits", value: 22 },
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Recent users table">
          {users.length ? (
            <div className="space-y-3">
              {users.slice(0, 6).map((user) => (
                <div
                  key={user.id}
                  className="grid gap-2 rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 md:grid-cols-[0.5fr_0.3fr_0.2fr]"
                >
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{user.displayName}</p>
                    <p className="text-sm text-[var(--muted)]">{user.email}</p>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{user.phone ?? "No phone"}</p>
                  <div className="flex justify-start md:justify-end">
                    <StatusBadge status={user.phoneVerified ? "verified" : "pending"} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No recent users available." />
          )}
        </AdminPanel>

        <AdminPanel title="Recent listings table">
          {active.items.length ? (
            <div className="space-y-3">
              {active.items.slice(0, 6).map((listing) => (
                <div
                  key={listing.id}
                  className="grid gap-2 rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 md:grid-cols-[0.58fr_0.22fr_0.2fr]"
                >
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{listing.title}</p>
                    <p className="text-sm text-[var(--muted)]">{listing.location}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{listing.priceLabel}</p>
                  <div className="flex justify-start md:justify-end">
                    <StatusBadge status={listing.status.toLowerCase() as "active" | "draft"} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No recent listings available." />
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="Recent moderation alerts" action={<Link href="/admin/moderation" className="text-sm font-semibold text-[var(--accent)]">Open queue</Link>}>
        {reports.length ? (
          <div className="space-y-3">
            {reports.slice(0, 6).map((item) => (
              <div
                key={item.listing.id}
                className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.listing.title}</p>
                  <StatusBadge status={item.openReportCount > 0 ? "pending" : "approved"} />
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Open reports: {item.openReportCount} • Total reports: {item.reportCount}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No moderation alerts at the moment." />
        )}
      </AdminPanel>
    </div>
  );
}
