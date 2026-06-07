import "server-only";

import {
  type MarketplaceNotification,
  type NotificationType,
} from "@/lib/notifications";

function getApiBaseUrl() {
  return process.env.MARKETPLACE_API_URL ?? "http://127.0.0.1:3001";
}

async function notificationRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
) {
  const response = await fetch(new URL(path, getApiBaseUrl()), {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

export function getNotificationsApiBaseUrl() {
  return getApiBaseUrl();
}

export async function fetchNotifications(
  accessToken: string,
  query: {
    unread?: boolean;
    type?: NotificationType;
    take?: number;
    cursor?: string;
  } = {},
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return notificationRequest<MarketplaceNotification[]>(
    `/notifications${params.size ? `?${params.toString()}` : ""}`,
    accessToken,
  );
}

export async function fetchUnreadNotificationCount(accessToken: string) {
  return notificationRequest<{ count: number }>(
    "/notifications/unread-count",
    accessToken,
  );
}
