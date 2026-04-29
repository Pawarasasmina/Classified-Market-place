import "server-only";

import { cookies } from "next/headers";

const accessTokenCookieName = "marketplace_access_token";
const maxAge = 60 * 60 * 24 * 7;

export async function getAccessToken() {
  return (await cookies()).get(accessTokenCookieName)?.value ?? null;
}

export async function setAccessToken(value: string) {
  (await cookies()).set(accessTokenCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearAccessToken() {
  (await cookies()).delete(accessTokenCookieName);
}
