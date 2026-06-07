export const adminPermissions = [
  "ADMIN_DASHBOARD",
  "AUDIT_LOGS_READ",
  "BOOSTS_READ",
  "BOOSTS_WRITE",
  "CATEGORIES_READ",
  "CATEGORIES_WRITE",
  "LISTINGS_READ",
  "LISTINGS_MODERATE",
  "LISTINGS_PRIORITY",
  "REPORTS_READ",
  "REPORTS_WRITE",
  "REPORTS_EMAIL",
  "REVIEWS_READ",
  "REVIEWS_MODERATE",
  "SUPPORT_READ",
  "TRANSACTIONS_READ",
  "USERS_READ",
  "USERS_WRITE",
  "WALLETS_WRITE",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

export const assignableUserRoles = [
  "USER",
  "ADMIN",
  "MODERATOR",
  "SUPPORT",
  "CATALOG_MANAGER",
  "FINANCE_MANAGER",
  "ANALYST",
] as const;

export type AssignableUserRole = (typeof assignableUserRoles)[number];

const adminRolePermissions: Record<string, readonly AdminPermission[]> = {
  ADMIN: adminPermissions,
  MODERATOR: [
    "ADMIN_DASHBOARD",
    "LISTINGS_READ",
    "LISTINGS_MODERATE",
    "REPORTS_READ",
    "REPORTS_WRITE",
    "REVIEWS_READ",
    "REVIEWS_MODERATE",
    "SUPPORT_READ",
  ],
  SUPPORT: [
    "ADMIN_DASHBOARD",
    "LISTINGS_READ",
    "REPORTS_READ",
    "REPORTS_WRITE",
    "SUPPORT_READ",
  ],
  CATALOG_MANAGER: [
    "ADMIN_DASHBOARD",
    "BOOSTS_READ",
    "CATEGORIES_READ",
    "CATEGORIES_WRITE",
    "LISTINGS_READ",
    "LISTINGS_PRIORITY",
  ],
  FINANCE_MANAGER: [
    "ADMIN_DASHBOARD",
    "BOOSTS_READ",
    "BOOSTS_WRITE",
    "REPORTS_READ",
    "REPORTS_EMAIL",
    "TRANSACTIONS_READ",
    "WALLETS_WRITE",
  ],
  ANALYST: [
    "ADMIN_DASHBOARD",
    "BOOSTS_READ",
    "CATEGORIES_READ",
    "LISTINGS_READ",
    "REPORTS_READ",
    "REVIEWS_READ",
    "TRANSACTIONS_READ",
  ],
};

export function normalizeRole(role: string | null | undefined) {
  return role?.trim().toUpperCase() ?? "";
}

export function getAdminPermissionsForRole(role: string | null | undefined) {
  return adminRolePermissions[normalizeRole(role)] ?? [];
}

export function hasAdminPermission(
  role: string | null | undefined,
  permission: AdminPermission,
) {
  return getAdminPermissionsForRole(role).includes(permission);
}

export function hasAnyAdminPermission(role: string | null | undefined) {
  return getAdminPermissionsForRole(role).length > 0;
}

export function humanizeAdminRole(role: string) {
  return normalizeRole(role)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
