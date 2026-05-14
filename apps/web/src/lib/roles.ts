export function isAdminRole(role: string) {
  const normalizedRole = role.trim().toLowerCase();
  return (
    normalizedRole === "admin" ||
    normalizedRole === "moderator" ||
    normalizedRole === "super_admin"
  );
}
