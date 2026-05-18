import "server-only";

import { cookies } from "next/headers";

const accessTokenCookieName = "marketplace_access_token";
const refreshTokenCookieName = "marketplace_refresh_token";
const accessMaxAge = 60 * 15;
const refreshMaxAge = 60 * 60 * 24 * 7;

export async function getAccessToken() {
  return (await cookies()).get(accessTokenCookieName)?.value ?? null;
}

export async function setAccessToken(value: string) {
  (await cookies()).set(accessTokenCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: accessMaxAge,
  });
}

export async function getRefreshToken() {
  return (await cookies()).get(refreshTokenCookieName)?.value ?? null;
}

export async function setRefreshToken(value: string, expiresAt?: string | Date) {
  const computedMaxAge = expiresAt
    ? Math.max(
        60,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      )
    : refreshMaxAge;

  (await cookies()).set(refreshTokenCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: computedMaxAge,
  });
}

export async function setSessionTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string | Date;
}) {
  await setAccessToken(tokens.accessToken);
  await setRefreshToken(tokens.refreshToken, tokens.refreshTokenExpiresAt);
}

export async function clearAccessToken() {
  const cookieStore = await cookies();
  cookieStore.delete(accessTokenCookieName);
  cookieStore.delete(refreshTokenCookieName);
}
