import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import {
  fetchCurrentUser,
  MarketplaceApiError,
  refreshSession,
} from "@/lib/marketplace-api";
import { appendNextParam } from "@/lib/redirects";
import {
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "@/lib/session";

export async function getSessionContext() {
  noStore();
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  try {
    const user = await fetchCurrentUser(accessToken);
    return { accessToken, user };
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 401) {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        return null;
      }

      try {
        const refreshed = await refreshSession(refreshToken);
        await setSessionTokens(refreshed);
        return {
          accessToken: refreshed.accessToken,
          user: refreshed.user,
        };
      } catch {
        return null;
      }
    }

    if (
      error instanceof MarketplaceApiError &&
      error.status === 503
    ) {
      return null;
    }

    throw error;
  }
}

export async function getSessionUser() {
  const session = await getSessionContext();
  return session?.user ?? null;
}

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
