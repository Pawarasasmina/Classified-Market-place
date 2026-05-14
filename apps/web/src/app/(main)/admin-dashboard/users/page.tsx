import { requireAdminSession } from "@/lib/auth-dal";
import { fetchAdminChatUsers } from "@/lib/messaging-api";
import { AdminPageHeader, AdminPanel, EmptyState, StatusBadge } from "@/components/marketplace/admin-ui";

type UsersPageProps = {
  searchParams: Promise<{
    q?: string;
    filter?: string;
  }>;
};

export default async function AdminUsersPage(props: UsersPageProps) {
  const { accessToken } = await requireAdminSession("/admin/users");
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? "").toLowerCase();
  const filter = (searchParams.filter ?? "all").toLowerCase();

  const users = await fetchAdminChatUsers(accessToken).catch(() => []);
  const filtered = users.filter((user) => {
    const matchesQuery =
      !q ||
      user.displayName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q);

    if (!matchesQuery) return false;
    if (filter === "phone-verified") return user.phoneVerified;
    if (filter === "email-verified") return user.emailVerified;
    if (filter === "admin") return user.role.toLowerCase() === "admin";
    if (filter === "moderator") return user.role.toLowerCase() === "moderator";
    return true;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="User Management"
        title="Review user accounts and trust posture."
        description="Filter users by verification or role, inspect account health signals, and route moderation decisions."
      />

      <AdminPanel title="Filters">
        <form className="grid gap-3 md:grid-cols-[0.6fr_0.4fr]">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search by name or email"
            className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
          />
          <select
            name="filter"
            defaultValue={filter}
            className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
          >
            <option value="all">All users</option>
            <option value="phone-verified">Phone verified</option>
            <option value="email-verified">Email verified</option>
            <option value="admin">Admins</option>
            <option value="moderator">Moderators</option>
          </select>
          <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] md:col-span-2 md:w-fit">
            Apply filters
          </button>
        </form>
      </AdminPanel>

      <AdminPanel title="User list">
        {filtered.length ? (
          <div className="space-y-3">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{user.displayName}</p>
                    <p className="text-sm text-[var(--muted)]">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={user.phoneVerified ? "verified" : "pending"} />
                    <StatusBadge status={user.emailVerified ? "approved" : "pending"} />
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-4">
                  <p>Role: {user.role}</p>
                  <p>Phone: {user.phone ?? "N/A"}</p>
                  <p>Reputation: {user.reputationScore}</p>
                  <p>KYC: Pending API</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Ban / Unban</button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Verify / Unverify</button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Add admin note</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No users found for the current filter/search." />
        )}
      </AdminPanel>
    </div>
  );
}
