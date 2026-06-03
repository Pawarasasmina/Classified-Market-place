import { hasAnyAdminPermission } from "@/lib/admin-permissions";

export function getSafeNextPath(
  input: FormDataEntryValue | string | null | undefined,
  fallback = "/"
) {
  if (typeof input !== "string") {
    return fallback;
  }

  if (!input.startsWith("/") || input.startsWith("//")) {
    return fallback;
  }

  return input;
}

export function appendNextParam(path: string, nextPath: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(nextPath)}`;
}

export function getPostAuthPath(
  user: { role?: string } | null | undefined,
  nextPath: string
) {
  if (
    hasAnyAdminPermission(user?.role) &&
    !nextPath.startsWith("/admin") &&
    !nextPath.startsWith("/?view=customer")
  ) {
    return "/admin";
  }

  return nextPath;
}
