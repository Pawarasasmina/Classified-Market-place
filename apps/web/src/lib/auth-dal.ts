import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { fetchCurrentUser, MarketplaceApiError } from "@/lib/marketplace-api";
import { appendNextParam } from "@/lib/redirects";
import { getAccessToken } from "@/lib/session";

export const getSessionContext = cache(async () => {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  try {
    const user = await fetchCurrentUser(accessToken);
    return { accessToken, user };
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 401) {
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
  const session = await requireSessionContext(nextPath);

  if (!session.user.phoneVerified) {
    redirect(appendNextParam("/verify", nextPath));
  }

  return session;
}
