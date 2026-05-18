import "server-only";

export type ChatMessageType =
  | "TEXT"
  | "IMAGE"
  | "FILE"
  | "LISTING_CARD"
  | "OFFER"
  | "SYSTEM";
export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type ChatParticipant = {
  userId: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  online: boolean;
};

export type ChatReadReceipt = {
  userId: string;
  readAt: string;
};

export type AdminChatUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  createdAt: string;
  updatedAt: string;
};

export type ChatListing = {
  id: string;
  title: string;
  price: number;
  currency: string;
  categoryName: string;
  status: string;
  location: string;
  sellerId: string;
  primaryImageUrl: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatarUrl: string | null;
  type: ChatMessageType;
  body: string | null;
  payload: Record<string, unknown> | null;
  listingId: string | null;
  listing: ChatListing | null;
  offerAmount: number | null;
  offerCurrency: string | null;
  offerStatus: OfferStatus | null;
  deletedAt: string | null;
  readBy: ChatReadReceipt[];
  createdAt: string;
  updatedAt: string;
};

export type ChatCounterpart = {
  userId: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  online: boolean;
};

export type ChatConversation = {
  id: string;
  listingId: string | null;
  listing: ChatListing | null;
  unreadCount: number;
  archivedAt: string | null;
  mutedAt: string | null;
  canSend: boolean;
  sendDisabledReason: string | null;
  blockedByMe: boolean;
  blockedByOther: boolean;
  participants: ChatParticipant[];
  counterpart: ChatCounterpart | null;
  title: string;
  lastMessage: ChatMessage | null;
  updatedAt: string;
};

export type ChatOfferUpdateResult = {
  offerMessage: ChatMessage;
  systemMessage: ChatMessage;
};

export type ChatDeleteMessageResult =
  | {
      scope: "me";
      conversationId: string;
      messageId: string;
      lastMessage: ChatMessage | null;
      updatedAt: string;
    }
  | {
      scope: "everyone";
      conversationId: string;
      message: ChatMessage;
      updatedAt: string;
    };

export type ChatReportReceipt = {
  id: string;
  status: string;
  createdAt: string;
};

export type ChatAdminReports = {
  conversationReports: Array<{
    id: string;
    conversationId: string;
    listingId: string | null;
    listingTitle: string | null;
    reporter: {
      id: string;
      displayName: string;
      role: string;
    };
    reason: string;
    details: string | null;
    status: string;
    createdAt: string;
  }>;
  messageReports: Array<{
    id: string;
    messageId: string;
    conversationId: string;
    reporter: {
      id: string;
      displayName: string;
      role: string;
    };
    reason: string;
    details: string | null;
    status: string;
    createdAt: string;
  }>;
};

function getApiBaseUrl() {
  return process.env.MARKETPLACE_API_URL ?? "http://127.0.0.1:3001";
}

async function messagingRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
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

export function getMessagingApiBaseUrl() {
  return getApiBaseUrl();
}

export async function fetchConversations(accessToken: string) {
  return messagingRequest<ChatConversation[]>("/messaging/conversations", accessToken);
}

export async function fetchArchivedConversations(accessToken: string) {
  return messagingRequest<ChatConversation[]>(
    "/messaging/conversations?archived=true",
    accessToken
  );
}

export async function fetchAdminChatUsers(accessToken: string) {
  return messagingRequest<AdminChatUser[]>("/users/admin/chat-users", accessToken);
}

export async function fetchSupportAdmins(accessToken: string) {
  return messagingRequest<AdminChatUser[]>("/users/support/admins", accessToken);
}

export async function createConversation(
  accessToken: string,
  payload: {
    listingId?: string;
    participantId?: string;
  }
) {
  return messagingRequest<ChatConversation>("/messaging/conversations", accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchConversationMessages(
  accessToken: string,
  conversationId: string
) {
  return messagingRequest<ChatMessage[]>(
    `/messaging/conversations/${conversationId}/messages`,
    accessToken
  );
}
