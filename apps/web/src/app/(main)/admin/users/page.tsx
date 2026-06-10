import Link from "next/link";
import { redirect } from "next/navigation";
import { updateAdminUserAction } from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { AdminTablePagination } from "@/components/marketplace/admin-table-pagination";
import {
  assignableUserRoles,
  hasAdminPermission,
  humanizeAdminRole,
} from "@/lib/admin-permissions";
import {
  buildAdminPaginationHref,
  getAdminPaginationHiddenFields,
  getAdminPaginationState,
  paginateAdminItems,
} from "@/lib/admin-pagination";
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

type AdminUsersPageProps = {
  searchParams: Promise<{
    q?: string;
    role?: string;
    tier?: ApiSellerPriorityTier;
    message?: string;
    user?: string;
    wallet?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function buildReturnTo(searchParams: Awaited<AdminUsersPageProps["searchParams"]>) {
  const params = new URLSearchParams();

  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.role) params.set("role", searchParams.role);
  if (searchParams.tier) params.set("tier", searchParams.tier);
  if (searchParams.page) params.set("page", searchParams.page);
  if (searchParams.pageSize) params.set("pageSize", searchParams.pageSize);

  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export default async function AdminUsersPage(props: AdminUsersPageProps) {
  const searchParams = await props.searchParams;
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
  const query = searchParams.q?.trim() ?? "";
  const role = searchParams.role?.trim().toUpperCase() ?? "";
  const tier = sellerTiers.includes(searchParams.tier as ApiSellerPriorityTier)
    ? searchParams.tier
    : "";
  const roles = Array.from(new Set(users.map((item) => item.role.toUpperCase())));
  const filteredUsers = users.filter((item) => {
    const matchesRole = !role || item.role.toUpperCase() === role;
    const matchesTier = !tier || (item.sellerPriorityTier ?? "NONE") === tier;
    const searchable = [item.displayName, item.email, item.phone, item.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || searchable.includes(query.toLowerCase());

    return matchesRole && matchesTier && matchesQuery;
  });
  const pagination = getAdminPaginationState(
    searchParams,
    filteredUsers.length,
  );
  const paginatedUsers = paginateAdminItems(filteredUsers, pagination);
  const paginationParams = { q: query, role, tier, pageSize: pagination.pageSize };
  const returnTo = buildReturnTo(searchParams);

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Seller trust"
        title="Users"
        description="Assign authorized, verified, and VIP priority tiers for customer search results."
        badge={`${filteredUsers.length} shown / ${users.length} total`}
        actions={
          <Link
            href="/admin"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Back to admin
          </Link>
        }
      />

      <AdminActionFeedback
        status={searchParams.user ?? searchParams.wallet}
        message={searchParams.message}
        messages={{
          updated: "User details updated.",
          invalid: searchParams.wallet
            ? "Check the wallet amount and try again."
            : "Check the user fields and try again.",
          credited: "Wallet credited.",
          debited: "Wallet debited.",
        }}
        successStatuses={["updated", "credited", "debited"]}
      />

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

      <form className="panel admin-filter-bar grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Search users
          <input
            name="q"
            defaultValue={query}
            className="surface-input"
            placeholder="Name, email, phone, or role"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Role
          <select name="role" defaultValue={role} className="surface-input">
            <option value="">All roles</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {humanizeAdminRole(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Seller tier
          <select name="tier" defaultValue={tier} className="surface-input">
            <option value="">All tiers</option>
            {sellerTiers.map((item) => (
              <option key={item} value={item}>
                {humanizeAdminRole(item)}
              </option>
            ))}
          </select>
        </label>
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <AdminTableEnhancer
        tableId="admin-users-table"
        copyLabel="user IDs"
        stickyActions
      />
      <div className="admin-table-wrap">
        <table id="admin-users-table" className="admin-table">
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
            {paginatedUsers.map((item) => (
              <tr key={item.id} data-row-id={item.id}>
                <td data-label="User">
                  <div className="grid gap-1">
                    <span className="font-semibold">{item.displayName}</span>
                    <span className="text-sm text-[var(--muted)]">
                      {item.email}
                    </span>
                  </div>
                </td>
                <td data-label="Role">
                  <span
                    className="admin-status-badge"
                    data-status={item.role.toLowerCase()}
                  >
                    {item.role}
                  </span>
                </td>
                <td data-label="Tier">
                  <span
                    className="admin-status-badge"
                    data-status={
                      (item.sellerPriorityTier ?? "NONE") === "NONE"
                        ? "none"
                        : "success"
                    }
                  >
                    {humanizeAdminRole(item.sellerPriorityTier ?? "NONE")}
                  </span>
                </td>
                <td data-label="Customer rating">
                  {sellerSummaries.get(item.id)?.ratingCount
                    ? `${sellerSummaries.get(item.id)?.averageRating?.toFixed(1)} / 5 (${sellerSummaries.get(item.id)?.ratingCount})`
                    : "No ratings"}
                </td>
                <td data-label="Reviews">
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
                <td data-label="Verified">
                  <span
                    className="admin-status-badge"
                    data-status={item.emailVerified || item.phoneVerified ? "yes" : "no"}
                  >
                    {item.emailVerified || item.phoneVerified ? "Yes" : "No"}
                  </span>
                </td>
                <td data-label="Actions">
                  {canEditUsers ? (
                    <form
                      action={updateAdminUserAction}
                      className="admin-row-actions-grid min-w-[280px]"
                    >
                      <input type="hidden" name="userId" value={item.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
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
                      <AdminSubmitButton
                        className="admin-table-action"
                        confirmMessage={`Save role, verification, or seller tier changes for ${item.displayName}?`}
                        pendingText="Saving..."
                      >
                        Save
                      </AdminSubmitButton>
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
        {filteredUsers.length === 0 ? (
          <div className="admin-empty-state">
            <p className="admin-empty-state-title">No users found</p>
            <p className="admin-empty-state-copy">
              Adjust the search, role, or seller tier filters to broaden the user list.
            </p>
          </div>
        ) : null}
      </div>
      {filteredUsers.length > 0 ? (
        <AdminTablePagination
          buildPageHref={(page, pageSize = pagination.pageSize) =>
            buildAdminPaginationHref("/admin/users", paginationParams, {
              page,
              pageSize,
            })
          }
          hiddenFields={getAdminPaginationHiddenFields(paginationParams)}
          itemLabel="users"
          pagination={pagination}
        />
      ) : null}
    </div>
  );
}
