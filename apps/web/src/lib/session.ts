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

export async function setRefreshToken(value: string) {
  (await cookies()).set(refreshTokenCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

export async function setSessionTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  await setAccessToken(tokens.accessToken);
  await setRefreshToken(tokens.refreshToken);
}

export async function clearAccessToken() {
  const cookieStore = await cookies();
  cookieStore.delete(accessTokenCookieName);
  cookieStore.delete(refreshTokenCookieName);
}
