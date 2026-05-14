import { moderateListingAction } from "@/app/(main)/actions";
import { requireAdminSession } from "@/lib/auth-dal";
import { fetchModerationQueue } from "@/lib/marketplace-api";
import { AdminPageHeader, AdminPanel, EmptyState, StatusBadge } from "@/components/marketplace/admin-ui";

export default async function AdminModerationPage() {
  const { accessToken } = await requireAdminSession("/admin/moderation");
  const queue = await fetchModerationQueue(accessToken, { take: 20 });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Moderation Queue"
        title="Review pending and AI-flagged listings."
        description="Approve, reject, remove, and annotate flagged content with internal moderation context."
      />

      <AdminPanel title="Queue">
        {queue.length ? (
          <div className="space-y-3">
            {queue.map((item) => {
              const fraudScore = Math.min(98, item.openReportCount * 24 + 18);

              return (
                <div key={item.listing.id} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{item.listing.title}</p>
                      <p className="text-sm text-[var(--muted)]">
                        Reports: {item.openReportCount} open / {item.reportCount} total • Fraud score: {fraudScore}
                      </p>
                    </div>
                    <StatusBadge status={item.openReportCount > 0 ? "pending" : "approved"} />
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <p className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
                      Safety warning: Requires image/content review before approval.
                    </p>
                    <p className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
                      Internal note: {item.latestReport?.details ?? "No note yet"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={moderateListingAction.bind(null, item.listing.id, "LISTING_APPROVED", item.latestReport?.id ?? null, "/admin/moderation")}>
                      <button className="rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        Approve
                      </button>
                    </form>
                    <form action={moderateListingAction.bind(null, item.listing.id, "LISTING_REJECTED", item.latestReport?.id ?? null, "/admin/moderation")}>
                      <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                        Reject with reason
                      </button>
                    </form>
                    <form action={moderateListingAction.bind(null, item.listing.id, "LISTING_REMOVED", item.latestReport?.id ?? null, "/admin/moderation")}>
                      <button className="rounded-full border border-[rgba(185,56,32,0.22)] bg-[rgba(255,243,240,0.95)] px-3 py-1 text-xs font-semibold text-[#8f2e1c]">
                        Remove listing
                      </button>
                    </form>
                    <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                      Ban seller
                    </button>
                    <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                      Add moderation note
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="No items in moderation queue." />
        )}
      </AdminPanel>
    </div>
  );
}
