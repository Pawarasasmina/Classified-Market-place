import Link from "next/link";
import { redirect } from "next/navigation";
import { updateAdminUserAction } from "@/app/(main)/actions";
import {
  assignableUserRoles,
  hasAdminPermission,
  humanizeAdminRole,
} from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminSellerRatingSummaries,
  fetchAdminUsers,
} from "@/lib/marketplace-api";
import type { ApiSellerPriorityTier } from "@/lib/marketplace";

const sellerTiers: ApiSellerPriorityTier[] = [
  "NONE",
  "AUTHORIZED",
  "VERIFIED",
  "VIP",
];

export default async function AdminUsersPage() {
  const { accessToken, user } = await requireSessionContext("/admin/users");

  if (!hasAdminPermission(user.role, "USERS_READ")) {
    redirect("/");
  }

  const canEditUsers = hasAdminPermission(user.role, "USERS_WRITE");
  const [users, summaries] = await Promise.all([
    fetchAdminUsers(accessToken),
    fetchAdminSellerRatingSummaries(accessToken),
  ]);
  const sellerSummaries = new Map(
    summaries.map((summary) => [summary.sellerId, summary]),
  );
  const prioritizedCount = users.filter(
    (item) => (item.sellerPriorityTier ?? "NONE") !== "NONE",
  ).length;

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Seller trust
          </p>
          <h1 className="mt-1 text-2xl font-bold">Users</h1>
          <p className="mt-2 text-[var(--muted)]">
            Assign authorized, verified, and VIP priority tiers for customer
            search results.
          </p>
        </div>
        <Link
          href="/admin"
          className="action-secondary px-4 py-2 text-sm font-semibold"
        >
          Back to admin
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Users", users.length],
          ["Seller tiers", prioritizedCount],
          ["Rated sellers", summaries.length],
          [
            "Verified contacts",
            users.filter((item) => item.emailVerified || item.phoneVerified)
              .length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Tier</th>
              <th>Customer rating</th>
              <th>Reviews</th>
              <th>Verified</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="grid gap-1">
                    <span className="font-semibold">{item.displayName}</span>
                    <span className="text-sm text-[var(--muted)]">
                      {item.email}
                    </span>
                  </div>
                </td>
                <td>{item.role}</td>
                <td>{humanizeAdminRole(item.sellerPriorityTier ?? "NONE")}</td>
                <td>
                  {sellerSummaries.get(item.id)?.ratingCount
                    ? `${sellerSummaries.get(item.id)?.averageRating?.toFixed(1)} / 5 (${sellerSummaries.get(item.id)?.ratingCount})`
                    : "No ratings"}
                </td>
                <td>
                  {sellerSummaries.get(item.id)?.reviewCount ? (
                    <Link
                      href={`/sellers/${item.id}?view=customer`}
                      className="font-semibold text-[var(--brand-strong)]"
                    >
                      {sellerSummaries.get(item.id)?.reviewCount} view
                    </Link>
                  ) : (
                    "0"
                  )}
                </td>
                <td>
                  {item.emailVerified || item.phoneVerified ? "Yes" : "No"}
                </td>
                <td>
                  {canEditUsers ? (
                    <form
                      action={updateAdminUserAction}
                      className="grid min-w-[280px] gap-2"
                    >
                      <input type="hidden" name="userId" value={item.id} />
                      <input type="hidden" name="name" value={item.displayName} />
                      <input
                        type="hidden"
                        name="phone"
                        value={item.phone ?? ""}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          name="role"
                          defaultValue={item.role.toUpperCase()}
                          className="surface-input"
                        >
                          {assignableUserRoles.map((role) => (
                            <option key={role} value={role}>
                              {humanizeAdminRole(role)}
                            </option>
                          ))}
                        </select>
                        <select
                          name="sellerPriorityTier"
                          defaultValue={item.sellerPriorityTier ?? "NONE"}
                          className="surface-input"
                        >
                          {sellerTiers.map((tier) => (
                            <option key={tier} value={tier}>
                              {humanizeAdminRole(tier)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm font-semibold">
                        <label className="flex items-center gap-2">
                          <input
                            name="isEmailVerified"
                            type="checkbox"
                            value="true"
                            defaultChecked={item.emailVerified}
                          />
                          Email
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            name="isPhoneVerified"
                            type="checkbox"
                            value="true"
                            defaultChecked={item.phoneVerified}
                          />
                          Phone
                        </label>
                      </div>
                      <button className="admin-table-action">Save</button>
                    </form>
                  ) : (
                    <span className="text-sm text-[var(--muted)]">
                      View only
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? (
          <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
            No users are available.
          </div>
        ) : null}
      </div>
    </div>
  );
}
