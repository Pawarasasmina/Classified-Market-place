"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatNotificationType,
  getNotificationDeepLink,
  type MarketplaceNotification,
} from "@/lib/notifications";

type NotificationsWorkspaceProps = {
  accessToken: string;
  apiBaseUrl: string;
  initialNotifications: MarketplaceNotification[];
  initialUnreadCount: number;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
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

export function NotificationsWorkspace({
  accessToken,
  apiBaseUrl,
  initialNotifications,
  initialUnreadCount,
}: NotificationsWorkspaceProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleNotifications =
    filter === "unread"
      ? notifications.filter((notification) => !notification.readAt)
      : notifications;
  const cursor = notifications.at(-1)?.id;

  async function markRead(notification: MarketplaceNotification, read = true) {
    setBusyId(notification.id);
    try {
      const updated = await notificationRequest<MarketplaceNotification>(
        apiBaseUrl,
        accessToken,
        `/notifications/${notification.id}/read`,
        {
          method: "PATCH",
          body: JSON.stringify({ read }),
        },
      );
      setNotifications((items) =>
        items.map((item) => (item.id === notification.id ? updated : item)),
      );
      setUnreadCount((value) => {
        if (!notification.readAt && read) {
          return Math.max(0, value - 1);
        }

        if (notification.readAt && !read) {
          return value + 1;
        }

        return value;
      });
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    await notificationRequest(
      apiBaseUrl,
      accessToken,
      "/notifications/read-all",
      {
        method: "PATCH",
        body: JSON.stringify({}),
      },
    );
    const readAt = new Date().toISOString();
    setNotifications((items) =>
      items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
    );
    setUnreadCount(0);
  }

  async function remove(notification: MarketplaceNotification) {
    setBusyId(notification.id);
    try {
      await notificationRequest(
        apiBaseUrl,
        accessToken,
        `/notifications/${notification.id}`,
        {
          method: "DELETE",
        },
      );
      setNotifications((items) =>
        items.filter((item) => item.id !== notification.id),
      );
      if (!notification.readAt) {
        setUnreadCount((value) => Math.max(0, value - 1));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    if (!cursor) {
      return;
    }

    setLoadingMore(true);
    try {
      const more = await notificationRequest<MarketplaceNotification[]>(
        apiBaseUrl,
        accessToken,
        `/notifications?take=25&cursor=${encodeURIComponent(cursor)}`,
      );
      setNotifications((items) => {
        const knownIds = new Set(items.map((item) => item.id));
        return [...items, ...more.filter((item) => !knownIds.has(item.id))];
      });
    } finally {
      setLoadingMore(false);
    }
  }

  async function openNotification(notification: MarketplaceNotification) {
    if (!notification.readAt) {
      await markRead(notification, true);
    }

    router.push(getNotificationDeepLink(notification));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="panel h-fit">
        <p className="section-eyebrow">Inbox</p>
        <h1 className="mt-2 text-2xl font-black">Notifications</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Track listing moderation, offers, messages, and boost updates.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-2 text-sm font-black ${
              filter === "all" ? "action-primary" : "action-secondary"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-md px-3 py-2 text-sm font-black ${
              filter === "unread" ? "action-primary" : "action-secondary"
            }`}
          >
            Unread
          </button>
        </div>
        <button
          type="button"
          disabled={!unreadCount}
          onClick={() => void markAllRead()}
          className="mt-3 w-full action-secondary px-3 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mark all read
        </button>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          {unreadCount} unread
        </p>
      </aside>

      <section className="grid gap-3">
        {visibleNotifications.length ? (
          visibleNotifications.map((notification) => (
            <article
              key={notification.id}
              className={`panel grid gap-4 ${
                notification.readAt ? "" : "border-[var(--brand)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className="grid min-w-0 gap-2 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-black">
                      {notification.title}
                    </span>
                    {!notification.readAt ? (
                      <span className="rounded-full bg-[var(--brand)] px-2 py-1 text-[0.65rem] font-black uppercase tracking-wide text-white">
                        New
                      </span>
                    ) : null}
                  </span>
                  {notification.body ? (
                    <span className="text-sm leading-6 text-[var(--muted)]">
                      {notification.body}
                    </span>
                  ) : null}
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    {formatNotificationType(notification.type)} -{" "}
                    {formatTimestamp(notification.createdAt)}
                  </span>
                </button>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === notification.id}
                    onClick={() =>
                      void markRead(notification, !notification.readAt)
                    }
                    className="action-secondary px-3 py-2 text-xs font-black disabled:opacity-50"
                  >
                    {notification.readAt ? "Unread" : "Read"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === notification.id}
                    onClick={() => void remove(notification)}
                    className="action-secondary px-3 py-2 text-xs font-black disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="panel py-12 text-center">
            <h2 className="text-xl font-black">No notifications here</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              New messages, offers, listing reviews, and boosts will appear
              here.
            </p>
          </div>
        )}

        {cursor && filter === "all" ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="action-secondary mx-auto px-4 py-3 text-sm font-black disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
