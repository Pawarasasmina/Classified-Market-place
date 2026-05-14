import { requireAdminSession } from "@/lib/auth-dal";
import { AdminPageHeader, AdminPanel } from "@/components/marketplace/admin-ui";

export default async function AdminPlatformSettingsPage() {
  await requireAdminSession("/admin/platform-settings");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform Settings"
        title="Configure core marketplace behavior and governance."
        description="Tune listing expiry, paid/free posting rules, report reasons, role permissions, banners, and maintenance controls."
      />

      <AdminPanel title="Core marketplace rules">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" defaultValue="30 days default listing expiry" />
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" defaultValue="Property category: paid posting enabled" />
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" defaultValue="Boost pricing profile: standard-v2" />
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" defaultValue="Report reasons set: v1.4" />
        </div>
      </AdminPanel>

      <AdminPanel title="Role & permission management">
        <div className="grid gap-3 md:grid-cols-3">
          <button className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold">
            Super admin permissions
          </button>
          <button className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold">
            Admin permissions
          </button>
          <button className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold">
            Moderator permissions
          </button>
        </div>
      </AdminPanel>

      <AdminPanel title="Maintenance mode">
        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold">
            Enable maintenance mode
          </button>
          <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            Save settings
          </button>
        </div>
      </AdminPanel>
    </div>
  );
}
