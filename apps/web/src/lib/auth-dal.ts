import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { fetchCurrentUser, MarketplaceApiError } from "@/lib/marketplace-api";
import { appendNextParam } from "@/lib/redirects";
import { getAccessToken } from "@/lib/session";
import { isAdminRole } from "@/lib/roles";

export { isAdminRole } from "@/lib/roles";

export const getSessionContext = cache(async () => {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  try {
    const user = await fetchCurrentUser(accessToken);
    return { accessToken, user };
  } catch (error) {
    if (
      error instanceof MarketplaceApiError &&
      (error.status === 401 || error.status === 503)
    ) {
      return null;
    }

    throw error;
  }
});

export const getSessionUser = cache(async () => {
  const session = await getSessionContext();
  return session?.user ?? null;
});

export async function requireSessionContext(nextPath = "/") {
  const session = await getSessionContext();

  if (!session) {
    redirect(appendNextParam("/login", nextPath));
  }

  return session;
}

export async function requireVerifiedSession(nextPath = "/sell") {
  return requireSessionContext(nextPath);
}

export async function requireAdminSession(nextPath = "/admin/dashboard") {
  const session = await getSessionContext();

  if (!session) {
    redirect(appendNextParam("/admin/login", nextPath));
  }

  if (!isAdminRole(session.user.role)) {
    redirect(appendNextParam("/admin/login", nextPath));
  }

  return session;
}

export async function requireClientSession(nextPath = "/dashboard") {
  const session = await requireSessionContext(nextPath);

  if (isAdminRole(session.user.role)) {
    redirect("/admin/dashboard");
  }

  return session;
}
