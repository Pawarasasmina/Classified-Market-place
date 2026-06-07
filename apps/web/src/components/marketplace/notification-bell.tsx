"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatNotificationType,
  getNotificationDeepLink,
  type MarketplaceNotification,
} from "@/lib/notifications";

type NotificationBellProps = {
  accessToken: string;
  apiBaseUrl: string;
};

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function notificationRequest<T>(
  apiBaseUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
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

export function NotificationBell({
  accessToken,
  apiBaseUrl,
}: NotificationBellProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<MarketplaceNotification[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [countResponse, latest] = await Promise.all([
      notificationRequest<{ count: number }>(
        apiBaseUrl,
        accessToken,
        "/notifications/unread-count",
      ),
      notificationRequest<MarketplaceNotification[]>(
        apiBaseUrl,
        accessToken,
        "/notifications?take=5",
      ),
    ]);

    setCount(countResponse.count);
    setNotifications(latest);
  }, [accessToken, apiBaseUrl]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh().catch(() => null);
    }, 0);
    const interval = window.setInterval(() => {
      void refresh().catch(() => null);
    }, 30000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  async function markAllRead() {
    setLoading(true);
    try {
      await notificationRequest(
        apiBaseUrl,
        accessToken,
        "/notifications/read-all",
        {
          method: "PATCH",
          body: JSON.stringify({}),
        },
      );
      setNotifications((items) =>
        items.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  async function openNotification(notification: MarketplaceNotification) {
    const href = getNotificationDeepLink(notification);
    setOpen(false);

    if (!notification.readAt) {
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      setCount((value) => Math.max(0, value - 1));
      await notificationRequest(
        apiBaseUrl,
        accessToken,
        `/notifications/${notification.id}/read`,
        {
          method: "PATCH",
          body: JSON.stringify({ read: true }),
        },
      ).catch(() => refresh().catch(() => null));
    }

    router.push(href);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        title="Notifications"
        onClick={() => setOpen((value) => !value)}
        className="marketplace-header-button relative flex h-10 w-10 items-center justify-center"
      >
        <BellIcon className="h-5 w-5" />
        {count ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[0.65rem] font-black leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div>
              <p className="text-sm font-black">Notifications</p>
              <p className="text-xs text-[var(--muted)]">
                {count ? `${count} unread` : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              disabled={!count || loading}
              onClick={markAllRead}
              className="text-xs font-black text-[var(--brand-strong)] disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => void openNotification(notification)}
                  className={`grid w-full gap-1 border-b border-[var(--line)] px-4 py-3 text-left text-sm hover:bg-[var(--brand-soft)] ${
                    notification.readAt ? "" : "bg-[var(--brand-soft)]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-black">{notification.title}</span>
                    {!notification.readAt ? (
                      <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                    ) : null}
                  </span>
                  {notification.body ? (
                    <span className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                      {notification.body}
                    </span>
                  ) : null}
                  <span className="text-[0.7rem] font-bold uppercase tracking-wide text-[var(--muted)]">
                    {formatNotificationType(notification.type)} -{" "}
                    {formatTimestamp(notification.createdAt)}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                No notifications yet.
              </div>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-sm font-black text-[var(--brand-strong)]"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
