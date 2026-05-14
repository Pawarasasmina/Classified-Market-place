import { requireAdminSession } from "@/lib/auth-dal";
import { AdminPageHeader, AdminPanel, ChartBars } from "@/components/marketplace/admin-ui";

export default async function AdminBoostsPage() {
  await requireAdminSession("/admin/boosts");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Boost & Promotions"
        title="Manage boosts, pricing, and promoted listing performance."
        description="Track active, expired, and scheduled boosts, and tune bump/highlight/top-ad pricing."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminPanel title="Active boosts">142</AdminPanel>
        <AdminPanel title="Expired boosts">58</AdminPanel>
        <AdminPanel title="Scheduled boosts">27</AdminPanel>
      </div>

      <ChartBars
        title="Revenue by boost type"
        data={[
          { label: "Bump", value: 36 },
          { label: "Highlight", value: 28 },
          { label: "Top Ad", value: 52 },
        ]}
      />

      <AdminPanel title="Boost pricing manager">
        <div className="grid gap-3 md:grid-cols-3">
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" defaultValue="AED 12 / day" />
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" defaultValue="AED 25 / day" />
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" defaultValue="AED 48 / day" />
        </div>
        <button className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          Save boost pricing
        </button>
      </AdminPanel>
    </div>
  );
}
