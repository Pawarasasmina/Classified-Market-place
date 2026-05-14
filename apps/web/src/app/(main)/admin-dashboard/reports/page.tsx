import { requireAdminSession } from "@/lib/auth-dal";
import { fetchModerationQueue } from "@/lib/marketplace-api";
import { AdminPageHeader, AdminPanel, EmptyState, StatusBadge } from "@/components/marketplace/admin-ui";

type ReportsPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function AdminReportsPage(props: ReportsPageProps) {
  const { accessToken } = await requireAdminSession("/admin/reports");
  const searchParams = await props.searchParams;
  const status = (searchParams.status ?? "pending").toLowerCase();
  const queue = await fetchModerationQueue(accessToken, {
    take: 25,
    reportStatus:
      status === "resolved"
        ? "RESOLVED"
        : status === "dismissed"
          ? "DISMISSED"
          : "OPEN",
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Reports & Complaints"
        title="Handle listing, user, chat, and fraud complaints."
        description="Filter report status, resolve or dismiss cases, escalate fraud concerns, and attach internal admin notes."
      />

      <AdminPanel title="Report filters">
        <form className="flex flex-wrap gap-2">
          {["pending", "resolved", "dismissed"].map((item) => (
            <button
              key={item}
              name="status"
              value={item}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                status === item
                  ? "bg-[var(--brand)] text-[var(--foreground)]"
                  : "border border-[var(--line)] bg-[var(--surface-strong)]"
              }`}
            >
              {item}
            </button>
          ))}
        </form>
      </AdminPanel>

      <AdminPanel title="Complaints queue">
        {queue.length ? (
          <div className="space-y-3">
            {queue.map((item) => (
              <div key={item.listing.id} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.listing.title}</p>
                  <StatusBadge status={status === "resolved" ? "approved" : status === "dismissed" ? "rejected" : "pending"} />
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Listing reports: {item.reportCount} • Open: {item.openReportCount}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Resolve</button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Dismiss</button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Escalate fraud</button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Add admin note</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No reports for selected status." />
        )}
      </AdminPanel>
    </div>
  );
}
