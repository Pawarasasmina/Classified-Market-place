export type NotificationType =
  | "SYSTEM"
  | "LISTING"
  | "MESSAGE"
  | "OFFER"
  | "BOOST"
  | "TRANSACTION"
  | "REPORT"
  | "RATING";

export type NotificationMetadata = Record<string, unknown> & {
  deepLink?: string;
  messageType?: string;
  status?: string;
};

export type MarketplaceNotification = {
  id: string;
  userId: string;
  actorId: string | null;
  listingId: string | null;
  conversationId: string | null;
  messageId: string | null;
  transactionId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: NotificationMetadata | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  actor?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  listing?: {
    id: string;
    title: string;
    status: string;
  } | null;
  conversation?: {
    id: string;
    listingId: string | null;
  } | null;
  message?: {
    id: string;
    type: string;
    conversationId: string;
    listingId: string | null;
    createdAt: string;
  } | null;
  transaction?: {
    id: string;
    type: string;
    status: string;
    amount: string | number;
    currency: string;
    createdAt: string;
  } | null;
};

export function getNotificationDeepLink(notification: MarketplaceNotification) {
  const deepLink = notification.metadata?.deepLink;

  if (typeof deepLink === "string" && deepLink.startsWith("/")) {
    return deepLink;
  }

  if (notification.conversationId) {
    return `/messages?conversation=${notification.conversationId}`;
  }

  if (notification.listingId) {
    return `/listings/${notification.listingId}`;
  }

  return "/notifications";
}

export function formatNotificationType(type: NotificationType) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
