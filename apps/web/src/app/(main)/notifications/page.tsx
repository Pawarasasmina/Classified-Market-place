import { NotificationsWorkspace } from "@/components/marketplace/notifications-workspace";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  getNotificationsApiBaseUrl,
} from "@/lib/notifications-api";

export default async function NotificationsPage() {
  const { accessToken } = await requireSessionContext("/notifications");
  const [notifications, unread] = await Promise.all([
    fetchNotifications(accessToken, { take: 25 }),
    fetchUnreadNotificationCount(accessToken),
  ]);

  return (
    <div className="page">
      <NotificationsWorkspace
        accessToken={accessToken}
        apiBaseUrl={getNotificationsApiBaseUrl()}
        initialNotifications={notifications}
        initialUnreadCount={unread.count}
      />
    </div>
  );
}
