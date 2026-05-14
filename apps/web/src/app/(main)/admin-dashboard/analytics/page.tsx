import { requireAdminSession } from "@/lib/auth-dal";
import { AdminPageHeader, AdminPanel, ChartBars } from "@/components/marketplace/admin-ui";

export default async function AdminAnalyticsPage() {
  await requireAdminSession("/admin/analytics");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Analytics"
        title="Marketplace growth, performance, and risk analytics."
        description="Understand user growth, listing behavior, category/location performance, fraud rate, and monetization trends."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartBars
          title="User growth chart"
          data={[
            { label: "Mon", value: 12 },
            { label: "Tue", value: 16 },
            { label: "Wed", value: 19 },
            { label: "Thu", value: 23 },
            { label: "Fri", value: 21 },
          ]}
        />
        <ChartBars
          title="Listing growth chart"
          data={[
            { label: "Property", value: 22 },
            { label: "Motors", value: 18 },
            { label: "Electronics", value: 16 },
            { label: "Jobs", value: 11 },
          ]}
        />
        <ChartBars
          title="Fraud / safety rate"
          data={[
            { label: "Reported", value: 9 },
            { label: "Escalated", value: 4 },
            { label: "Removed", value: 3 },
            { label: "Dismissed", value: 6 },
          ]}
        />
      </div>

      <AdminPanel title="Report exports">
        <div className="flex flex-wrap gap-2">
          <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Export user growth</button>
          <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Export listing performance</button>
          <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Export revenue analytics</button>
          <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Export fraud analytics</button>
        </div>
      </AdminPanel>
    </div>
  );
}
