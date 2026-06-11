/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { updateAdminUserAction } from "@/app/(main)/actions";
import { AdminSubmitButton } from "@/components/marketplace/admin-form-feedback";
import type { AdminUser } from "@/lib/marketplace";

type AdminUserCardProps = {
  user: AdminUser;
  returnTo: string;
  expanded?: boolean;
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminUserCard({
  user,
  returnTo,
  expanded = false,
}: AdminUserCardProps) {
  return (
    <article className="admin-user-card">
      <div className="admin-user-card-header">
        <div className="admin-user-avatar">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{initials(user.displayName || user.email)}</span>
          )}
        </div>
        <div className="admin-user-identity">
          <h2>{user.displayName}</h2>
          <p>{user.email}</p>
          <div>
            <span>{user.role.toUpperCase()}</span>
            <span>{user.emailVerified ? "Email verified" : "Email unverified"}</span>
            <span>{user.phoneVerified ? "Phone verified" : "Phone unverified"}</span>
          </div>
        </div>
      </div>

      <div className="admin-user-metrics">
        <div>
          <span>Listings</span>
          <strong>{user.adminStats.totalListings}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{user.adminStats.activeListings}</strong>
        </div>
        <div>
          <span>Bookings</span>
          <strong>{user.adminStats.bookingCount}</strong>
        </div>
        <div>
          <span>Offers</span>
          <strong>{user.adminStats.offerCount}</strong>
        </div>
      </div>

      <div className="admin-user-links">
        <Link href={`/admin/users/${user.id}`}>Details</Link>
        <Link href={`/admin/users/${user.id}/listings`}>Listings</Link>
        <Link href={`/admin/users/${user.id}/bookings`}>Bookings</Link>
      </div>

      <form action={updateAdminUserAction} className="admin-user-form">
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="admin-user-form-grid">
          <label>
            <span>Name</span>
            <input name="displayName" defaultValue={user.displayName} />
          </label>
          <label>
            <span>Role</span>
            <select name="role" defaultValue={user.role.toUpperCase()}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label>
            <span>Phone</span>
            <input name="phone" defaultValue={user.phone ?? ""} />
          </label>
          <label>
            <span>Location</span>
            <input name="location" defaultValue={user.location ?? ""} />
          </label>
          {expanded ? (
            <>
              <label>
                <span>Avatar URL</span>
                <input name="avatarUrl" defaultValue={user.avatarUrl ?? ""} />
              </label>
              <label>
                <span>Reputation</span>
                <input value={user.reputationScore} readOnly />
              </label>
              <label className="admin-user-form-wide">
                <span>Bio</span>
                <textarea name="bio" defaultValue={user.bio ?? ""} rows={3} />
              </label>
            </>
          ) : null}
          <label>
            <span>Email verified</span>
            <select name="emailVerified" defaultValue={String(user.emailVerified)}>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </label>
          <label>
            <span>Phone verified</span>
            <select name="phoneVerified" defaultValue={String(user.phoneVerified)}>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </label>
        </div>
        <div className="admin-user-form-footer">
          <span>Joined {formatDate(user.createdAt)}</span>
          <AdminSubmitButton
            confirmMessage={`Save account, role, verification, or profile changes for ${user.displayName}?`}
            pendingText="Saving user..."
          >
            Save user
          </AdminSubmitButton>
        </div>
      </form>
    </article>
  );
}
