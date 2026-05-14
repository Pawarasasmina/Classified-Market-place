import { requireAdminSession } from "@/lib/auth-dal";
import { fetchAdminChatUsers } from "@/lib/messaging-api";
import { AdminPageHeader, AdminPanel, StatusBadge } from "@/components/marketplace/admin-ui";

export default async function AdminVerificationPage() {
  const { accessToken } = await requireAdminSession("/admin/verification");
  const users = await fetchAdminChatUsers(accessToken).catch(() => []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Verification / KYC"
        title="Review phone, email, ID, and business verification requests."
        description="Approve or reject verification requests, review uploaded KYC docs, and apply verified badge states."
      />

      <AdminPanel title="Verification queue">
        <div className="space-y-3">
          {users.slice(0, 12).map((user) => (
            <div key={user.id} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{user.displayName}</p>
                  <p className="text-sm text-[var(--muted)]">{user.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={user.phoneVerified ? "verified" : "pending"} />
                  <StatusBadge status={user.emailVerified ? "verified" : "pending"} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">View documents</button>
                <button className="rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">Approve KYC</button>
                <button className="rounded-full border border-[rgba(185,56,32,0.22)] bg-[rgba(255,243,240,0.95)] px-3 py-1 text-xs font-semibold text-[#8f2e1c]">Reject with reason</button>
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
