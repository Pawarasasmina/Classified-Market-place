import { requireAdminSession } from "@/lib/auth-dal";
import { AdminPageHeader, AdminPanel } from "@/components/marketplace/admin-ui";

export default async function AdminNotificationsPage() {
  await requireAdminSession("/admin/notifications");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Notification Management"
        title="Manage announcements and marketplace notification templates."
        description="Support email, push, in-app, and WhatsApp communication for listing, KYC, and payment lifecycle events."
      />

      <AdminPanel title="Send admin announcement">
        <div className="grid gap-3">
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" placeholder="Announcement title" />
          <textarea className="min-h-28 rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" placeholder="Announcement body..." />
          <select className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none">
            <option>In-app</option>
            <option>Email</option>
            <option>Push</option>
            <option>WhatsApp</option>
          </select>
          <button className="w-fit rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            Send announcement
          </button>
        </div>
      </AdminPanel>

      <AdminPanel title="Templates">
        <div className="grid gap-3">
          {[
            "Listing approved",
            "Listing rejected",
            "Payment success",
            "KYC approved",
            "KYC rejected",
          ].map((template) => (
            <div key={template} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
              {template}
            </div>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
