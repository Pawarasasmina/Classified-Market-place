"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  type ChatAdminReports,
  type ChatConversation,
  type ChatDeleteMessageResult,
  type ChatMessage,
  type ChatOfferUpdateResult,
} from "@/lib/messaging-api";
import { hasAdminPermission } from "@/lib/admin-permissions";

type InboxWorkspaceProps = {
  accessToken: string;
  apiBaseUrl: string;
  currentUserId: string;
  currentUserRole: string;
  selectedConversationId?: string | null;
  selectedListingId?: string;
  selectedParticipantId?: string;
};

type InboxView = "active" | "archived";
type ComposerMode = "TEXT" | "OFFER" | "IMAGE";

type ChatBuckets = {
  active: ChatConversation[];
  archived: ChatConversation[];
};

type ReadEventPayload = {
  conversationId: string;
  userId: string;
  readAt: string;
};

const EMPTY_BUCKETS: ChatBuckets = {
  active: [],
  archived: [],
};
const deleteForEveryoneWindowMs = 15 * 60 * 1000;

function isStaffRole(role: string) {
  return hasAdminPermission(role, "SUPPORT_READ");
}

function sortConversations(conversations: ChatConversation[]) {
  return [...conversations].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function formatConversationTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();

  return new Intl.DateTimeFormat(undefined, {
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMessageTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function canDeleteForEveryone(message: ChatMessage, currentUserId: string) {
  if (
    message.senderId !== currentUserId ||
    message.deletedAt ||
    message.type === "SYSTEM"
  ) {
    return false;
  }

  return Date.now() - new Date(message.createdAt).getTime() <= deleteForEveryoneWindowMs;
}

function messagePreview(message: ChatMessage | null, currentUserId: string) {
  if (!message) {
    return "No messages yet";
  }

  if (message.deletedAt) {
    return message.senderId === currentUserId
      ? "You deleted a message"
      : "This message was deleted";
  }

  switch (message.type) {
    case "TEXT":
      return message.body ?? "Text message";
    case "OFFER":
      return `Offer: ${message.offerCurrency ?? ""} ${message.offerAmount ?? ""}`.trim();
    case "IMAGE":
      return "Image shared";
    case "FILE":
      return "File shared";
    case "LISTING_CARD":
      return "Listing details shared";
    case "SYSTEM":
      return message.body ?? "Conversation update";
    default:
      return "New message";
  }
}

function normalizeApiError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const message = error.message.replace(/^Error:\s*/i, "").trim();
  return message || fallback;
}

function removeConversationFromBuckets(
  buckets: ChatBuckets,
  conversationId: string
): ChatBuckets {
  return {
    active: buckets.active.filter((conversation) => conversation.id !== conversationId),
    archived: buckets.archived.filter((conversation) => conversation.id !== conversationId),
  };
}

function upsertConversation(
  buckets: ChatBuckets,
  conversation: ChatConversation
): ChatBuckets {
  const sanitized = removeConversationFromBuckets(buckets, conversation.id);
  const key: InboxView = conversation.archivedAt ? "archived" : "active";

  return {
    ...sanitized,
    [key]: sortConversations([...sanitized[key], conversation]),
  };
}

function updateConversationById(
  buckets: ChatBuckets,
  conversationId: string,
  updater: (conversation: ChatConversation) => ChatConversation
) {
  let updated: ChatConversation | null = null;

  const nextBuckets: ChatBuckets = {
    active: buckets.active.map((conversation) => {
      if (conversation.id !== conversationId) {
        return conversation;
      }

      updated = updater(conversation);
      return updated;
    }),
    archived: buckets.archived.map((conversation) => {
      if (conversation.id !== conversationId) {
        return conversation;
      }

      updated = updater(conversation);
      return updated;
    }),
  };

  if (!updated) {
    return buckets;
  }

  return upsertConversation(removeConversationFromBuckets(nextBuckets, conversationId), updated);
}

function getImagePayload(message: ChatMessage) {
  const payload = message.payload;

  if (!payload || typeof payload.url !== "string") {
    return null;
  }

  return {
    url: payload.url,
    alt: typeof payload.alt === "string" ? payload.alt : message.body ?? "Shared image",
  };
}

function getFilePayload(message: ChatMessage) {
  const payload = message.payload;

  if (!payload || typeof payload.url !== "string") {
    return null;
  }

  return {
    url: payload.url,
    name:
      typeof payload.name === "string"
        ? payload.name
        : message.body ?? "Download file",
  };
}

export function InboxWorkspace({
  accessToken,
  apiBaseUrl,
  currentUserId,
  currentUserRole,
  selectedConversationId = null,
  selectedListingId,
  selectedParticipantId,
}: InboxWorkspaceProps) {
  const [conversationBuckets, setConversationBuckets] =
    useState<ChatBuckets>(EMPTY_BUCKETS);
  const [inboxView, setInboxView] = useState<InboxView>("active");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    selectedConversationId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("TEXT");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerCurrency, setOfferCurrency] = useState("AED");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [staffReports, setStaffReports] = useState<ChatAdminReports | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<string | null>(activeConversationId);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingStartedRef = useRef(false);
  const tempIdRef = useRef(0);

  const isStaff = isStaffRole(currentUserRole);

  const apiRequest = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
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
    },
    [accessToken, apiBaseUrl]
  );

  const patchConversation = useCallback(
    (conversationId: string, updater: (conversation: ChatConversation) => ChatConversation) => {
      setConversationBuckets((current) =>
        updateConversationById(current, conversationId, updater)
      );
    },
    []
  );

  const replaceConversation = useCallback((conversation: ChatConversation) => {
    setConversationBuckets((current) => upsertConversation(current, conversation));
  }, []);

  const applyReadReceipt = useCallback(
    (userId: string, readAt: string) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.senderId !== currentUserId) {
            return message;
          }

          if (message.readBy.some((receipt) => receipt.userId === userId)) {
            return message;
          }

          return {
            ...message,
            readBy: [...message.readBy, { userId, readAt }],
          };
        })
      );
    },
    [currentUserId]
  );

  const stopTyping = useCallback((conversationId: string | null) => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!conversationId || !typingStartedRef.current || !socketRef.current?.connected) {
      typingStartedRef.current = false;
      return;
    }

    socketRef.current.emit("typing:stop", { conversationId });
    typingStartedRef.current = false;
  }, []);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      patchConversation(conversationId, (conversation) => ({
        ...conversation,
        unreadCount: 0,
      }));

      if (socketRef.current?.connected) {
        socketRef.current.emit("message:read", { conversationId });
        return;
      }

      await apiRequest<ReadEventPayload>(`/messaging/conversations/${conversationId}/read`, {
        method: "POST",
      });
    },
    [apiRequest, patchConversation]
  );

  const reconcileOutboundMessage = useCallback(
    (tempId: string, realMessage: ChatMessage) => {
      setMessages((current) => {
        const withoutTemp = current.filter((message) => message.id !== tempId);
        if (withoutTemp.some((message) => message.id === realMessage.id)) {
          return withoutTemp;
        }

        return [...withoutTemp, realMessage];
      });
      patchConversation(realMessage.conversationId, (conversation) => ({
        ...conversation,
        lastMessage: realMessage,
        updatedAt: realMessage.updatedAt,
        unreadCount: 0,
        archivedAt: null,
      }));
    },
    [patchConversation]
  );

  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const socket = io(`${apiBaseUrl}/messaging`, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (activeIdRef.current) {
        socket.emit("conversation:join", { conversationId: activeIdRef.current });
      }
    });

    socket.on("message:new", (message: ChatMessage) => {
      const isActiveThread = message.conversationId === activeIdRef.current;

      if (isActiveThread) {
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message]
        );

        if (message.senderId !== currentUserId) {
          void markConversationRead(message.conversationId);
        }
      }

      setConversationBuckets((current) => {
        const existing =
          current.active.find((conversation) => conversation.id === message.conversationId) ??
          current.archived.find((conversation) => conversation.id === message.conversationId);

        if (!existing) {
          return current;
        }

        return upsertConversation(current, {
          ...existing,
          lastMessage: message,
          updatedAt: message.updatedAt,
          archivedAt: null,
          unreadCount:
            message.senderId !== currentUserId && !isActiveThread
              ? existing.unreadCount + 1
              : 0,
        });
      });
    });

    socket.on("message:read", (payload: ReadEventPayload) => {
      if (payload.conversationId === activeIdRef.current) {
        applyReadReceipt(payload.userId, payload.readAt);
      }

      if (payload.userId === currentUserId) {
        patchConversation(payload.conversationId, (conversation) => ({
          ...conversation,
          unreadCount: 0,
        }));
      }
    });

    socket.on(
      "presence:update",
      (payload: { userId: string; online: boolean; onlineUserIds?: string[] }) => {
        const onlineUserIds = new Set(payload.onlineUserIds ?? []);

        setConversationBuckets((current) => ({
          active: current.active.map((conversation) => ({
            ...conversation,
            participants: conversation.participants.map((participant) => ({
              ...participant,
              online: payload.onlineUserIds
                ? onlineUserIds.has(participant.userId)
                : participant.userId === payload.userId
                  ? payload.online
                  : participant.online,
            })),
            counterpart:
              conversation.counterpart &&
              (payload.onlineUserIds
                ? {
                    ...conversation.counterpart,
                    online: onlineUserIds.has(conversation.counterpart.userId),
                  }
                : conversation.counterpart.userId === payload.userId
                  ? { ...conversation.counterpart, online: payload.online }
                  : conversation.counterpart),
          })),
          archived: current.archived.map((conversation) => ({
            ...conversation,
            participants: conversation.participants.map((participant) => ({
              ...participant,
              online: payload.onlineUserIds
                ? onlineUserIds.has(participant.userId)
                : participant.userId === payload.userId
                  ? payload.online
                  : participant.online,
            })),
            counterpart:
              conversation.counterpart &&
              (payload.onlineUserIds
                ? {
                    ...conversation.counterpart,
                    online: onlineUserIds.has(conversation.counterpart.userId),
                  }
                : conversation.counterpart.userId === payload.userId
                  ? { ...conversation.counterpart, online: payload.online }
                  : conversation.counterpart),
          })),
        }));
      }
    );

    socket.on(
      "typing:update",
      (payload: {
        conversationId: string;
        userId: string;
        displayName: string;
        typing: boolean;
      }) => {
        if (payload.conversationId !== activeIdRef.current || payload.userId === currentUserId) {
          return;
        }

        setTypingUser(payload.typing ? payload.displayName : null);
      }
    );

    socket.on("offer:updated", (payload: ChatOfferUpdateResult) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === payload.offerMessage.id ? payload.offerMessage : message
        )
      );
      setConversationBuckets((current) =>
        updateConversationById(current, payload.offerMessage.conversationId, (conversation) => ({
          ...conversation,
          lastMessage:
            conversation.lastMessage?.id === payload.offerMessage.id
              ? payload.offerMessage
              : conversation.lastMessage,
        }))
      );
    });

    socket.on("message:deleted", (message: ChatMessage) => {
      setOpenMessageMenuId((current) => (current === message.id ? null : current));
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) =>
          current.map((item) => (item.id === message.id ? message : item))
        );
      }

      setConversationBuckets((current) =>
        updateConversationById(current, message.conversationId, (conversation) => ({
          ...conversation,
          lastMessage:
            conversation.lastMessage?.id === message.id
              ? message
              : conversation.lastMessage,
          updatedAt:
            conversation.lastMessage?.id === message.id
              ? message.updatedAt
              : conversation.updatedAt,
        }))
      );
    });

    return () => {
      if (activeIdRef.current) {
        stopTyping(activeIdRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    accessToken,
    apiBaseUrl,
    applyReadReceipt,
    currentUserId,
    markConversationRead,
    patchConversation,
    stopTyping,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      setIsLoadingConversations(true);

      try {
        const [active, archived] = await Promise.all([
          apiRequest<ChatConversation[]>("/messaging/conversations"),
          apiRequest<ChatConversation[]>("/messaging/conversations?archived=true"),
        ]);
        const reportsPromise = isStaff
          ? apiRequest<ChatAdminReports>("/messaging/admin/reports").catch(() => null)
          : Promise.resolve(null);
        let targetConversation =
          selectedConversationId
            ? active.find((conversation) => conversation.id === selectedConversationId) ??
              archived.find((conversation) => conversation.id === selectedConversationId) ??
              null
            : active[0] ?? archived[0] ?? null;

        if (selectedListingId) {
          targetConversation = await apiRequest<ChatConversation>("/messaging/conversations", {
            method: "POST",
            body: JSON.stringify({ listingId: selectedListingId }),
          });
        } else if (selectedParticipantId) {
          targetConversation = await apiRequest<ChatConversation>("/messaging/conversations", {
            method: "POST",
            body: JSON.stringify({ participantId: selectedParticipantId }),
          });
        }

        const nextBuckets = targetConversation
          ? upsertConversation(
              {
                active,
                archived,
              },
              targetConversation
            )
          : {
              active,
              archived,
            };
        const nextMessages =
          targetConversation?.id
            ? await apiRequest<ChatMessage[]>(
                `/messaging/conversations/${targetConversation.id}/messages`
              )
            : [];
        const reports = await reportsPromise;

        if (cancelled) {
          return;
        }

        setConversationBuckets(nextBuckets);
        setInboxView(targetConversation?.archivedAt ? "archived" : "active");
        setActiveConversationId(targetConversation?.id ?? null);
        setMessages(nextMessages);
        setStaffReports(reports);

        if (targetConversation?.id) {
          socketRef.current?.emit("conversation:join", {
            conversationId: targetConversation.id,
          });
          await markConversationRead(targetConversation.id);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(normalizeApiError(loadError, "Could not load conversations."));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConversations(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    apiRequest,
    isStaff,
    markConversationRead,
    selectedConversationId,
    selectedListingId,
    selectedParticipantId,
  ]);

  const activeConversation =
    conversationBuckets.active.find((conversation) => conversation.id === activeConversationId) ??
    conversationBuckets.archived.find(
      (conversation) => conversation.id === activeConversationId
    ) ??
    null;
  const visibleConversations =
    inboxView === "active" ? conversationBuckets.active : conversationBuckets.archived;
  const otherParticipants =
    activeConversation?.participants.filter((participant) => participant.userId !== currentUserId) ??
    [];
  const activeCounterpart = activeConversation?.counterpart ?? otherParticipants[0] ?? null;
  const lastOwnMessage = [...messages]
    .reverse()
    .find((message) => message.senderId === currentUserId);
  const lastOwnMessageRead =
    lastOwnMessage?.readBy.some((receipt) => receipt.userId !== currentUserId) ?? false;

  async function openConversation(conversation: ChatConversation, nextView: InboxView) {
    stopTyping(activeIdRef.current);
    setInboxView(nextView);
    setActiveConversationId(conversation.id);
    activeIdRef.current = conversation.id;
    setOpenMessageMenuId(null);
    socketRef.current?.emit("conversation:join", { conversationId: conversation.id });
    setMessages(
      await apiRequest<ChatMessage[]>(`/messaging/conversations/${conversation.id}/messages`)
    );
    setTypingUser(null);
    await markConversationRead(conversation.id);
  }

  async function sendPayloadMessage(
    input:
      | { type: "TEXT"; body: string; payload?: Record<string, unknown> | null }
      | {
          type: "OFFER";
          body?: string | null;
          offerAmount: number;
          offerCurrency: string;
          payload?: Record<string, unknown> | null;
        }
      | {
          type: "IMAGE";
          body?: string | null;
          payload: { url: string; alt?: string };
        }
      | {
          type: "LISTING_CARD";
          listingId?: string;
          payload?: Record<string, unknown> | null;
        }
  ) {
    if (!activeConversationId || !activeConversation) {
      return;
    }

    setIsSending(true);
    setError("");
    const now = new Date().toISOString();
    const tempId = `temp-${now}-${tempIdRef.current++}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: "You",
      senderRole: currentUserRole,
      senderAvatarUrl: null,
      type: input.type,
      body: "body" in input ? input.body ?? null : null,
      payload: input.payload ?? null,
      listingId: "listingId" in input ? input.listingId ?? activeConversation.listingId : activeConversation.listingId,
      listing: activeConversation.listing,
      offerAmount: input.type === "OFFER" ? input.offerAmount : null,
      offerCurrency: input.type === "OFFER" ? input.offerCurrency : null,
      offerStatus: input.type === "OFFER" ? "PENDING" : null,
      deletedAt: null,
      readBy: [{ userId: currentUserId, readAt: now }],
      createdAt: now,
      updatedAt: now,
    };

    setMessages((current) => [...current, tempMessage]);
    patchConversation(activeConversationId, (conversation) => ({
      ...conversation,
      lastMessage: tempMessage,
      updatedAt: tempMessage.updatedAt,
      unreadCount: 0,
      archivedAt: null,
    }));

    const socket = socketRef.current;

    try {
      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket.emit(
            "message:send",
            {
              conversationId: activeConversationId,
              message: input,
            },
            (response: ChatMessage | { message?: string }) => {
              if (response && "id" in response) {
                reconcileOutboundMessage(tempId, response);
                resolve();
                return;
              }

              reject(new Error("Could not send your message."));
            }
          );
        });
      } else {
        const message = await apiRequest<ChatMessage>(
          `/messaging/conversations/${activeConversationId}/messages`,
          {
            method: "POST",
            body: JSON.stringify(input),
          }
        );
        reconcileOutboundMessage(tempId, message);
      }

      setDraft("");
      setOfferAmount("");
      setImageUrl("");
      stopTyping(activeConversationId);
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      patchConversation(activeConversationId, (conversation) => ({
        ...conversation,
        lastMessage:
          conversation.lastMessage?.id === tempId ? null : conversation.lastMessage,
      }));
      setError(normalizeApiError(sendError, "Could not send your message."));
      throw sendError;
    } finally {
      setIsSending(false);
    }
  }

  async function sendComposerMessage() {
    if (!activeConversation || !activeConversationId) {
      return;
    }

    if (!activeConversation.canSend) {
      setError(
        activeConversation.sendDisabledReason ?? "This conversation is read-only."
      );
      return;
    }

    try {
      if (composerMode === "OFFER") {
        const amount = Number(offerAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          setError("Enter a valid offer amount.");
          return;
        }

        await sendPayloadMessage({
          type: "OFFER",
          body: draft.trim() || null,
          offerAmount: amount,
          offerCurrency:
            offerCurrency.trim().toUpperCase() || activeConversation.listing?.currency || "AED",
          payload: draft.trim() ? { note: draft.trim() } : null,
        });
        return;
      }

      if (composerMode === "IMAGE") {
        if (!imageUrl.trim()) {
          setError("Enter an image URL to share.");
          return;
        }

        await sendPayloadMessage({
          type: "IMAGE",
          body: draft.trim() || null,
          payload: {
            url: imageUrl.trim(),
            alt: draft.trim() || undefined,
          },
        });
        return;
      }

      const body = draft.trim();

      if (!body) {
        return;
      }

      await sendPayloadMessage({
        type: "TEXT",
        body,
      });
    } catch {
      if (composerMode === "TEXT") {
        setDraft((current) => current || draft);
      }
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);

    if (
      composerMode !== "TEXT" ||
      !activeConversationId ||
      !socketRef.current?.connected ||
      !activeConversation?.canSend
    ) {
      return;
    }

    if (!value.trim()) {
      stopTyping(activeConversationId);
      return;
    }

    if (!typingStartedRef.current) {
      socketRef.current.emit("typing:start", {
        conversationId: activeConversationId,
      });
      typingStartedRef.current = true;
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      stopTyping(activeConversationId);
    }, 1200);
  }

  async function togglePreference(
    payload: Partial<Pick<ChatConversation, "archivedAt" | "mutedAt">> & {
      archived?: boolean;
      muted?: boolean;
    }
  ) {
    if (!activeConversationId) {
      return;
    }

    const updated = await apiRequest<ChatConversation>(
      `/messaging/conversations/${activeConversationId}/preferences`,
      {
        method: "PATCH",
        body: JSON.stringify({
          archived: payload.archived,
          muted: payload.muted,
        }),
      }
    );
    replaceConversation(updated);
    setInboxView(updated.archivedAt ? "archived" : "active");
  }

  async function shareListingCard() {
    if (!activeConversation?.listing) {
      return;
    }

    try {
      await sendPayloadMessage({
        type: "LISTING_CARD",
        listingId: activeConversation.listing.id,
      });
    } catch {
      return;
    }
  }

  async function reportConversation() {
    if (!activeConversationId) {
      return;
    }

    const reason = window.prompt("Why are you reporting this conversation?");

    if (!reason?.trim()) {
      return;
    }

    try {
      await apiRequest(`/messaging/conversations/${activeConversationId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setError("Conversation report submitted for review.");
    } catch (reportError) {
      setError(normalizeApiError(reportError, "Could not report this conversation."));
    }
  }

  async function blockCounterpart() {
    if (!activeConversationId || !activeCounterpart) {
      return;
    }

    const reason = window.prompt(
      `Block ${activeCounterpart.displayName}? Add an optional reason.`
    );

    try {
      const updated = await apiRequest<ChatConversation>(
        `/messaging/conversations/${activeConversationId}/block`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reason ?? undefined }),
        }
      );
      replaceConversation(updated);
      setError(`${activeCounterpart.displayName} has been blocked for this marketplace chat.`);
    } catch (blockError) {
      setError(normalizeApiError(blockError, "Could not block this user."));
    }
  }

  async function reportMessage(messageId: string) {
    const reason = window.prompt("Why are you reporting this message?");

    if (!reason?.trim()) {
      return;
    }

    try {
      await apiRequest(`/messaging/messages/${messageId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setError("Message report submitted for review.");
    } catch (reportError) {
      setError(normalizeApiError(reportError, "Could not report this message."));
    }
  }

  async function updateOfferStatus(message: ChatMessage, status: "ACCEPTED" | "DECLINED") {
    if (!activeConversationId) {
      return;
    }

    try {
      const socket = socketRef.current;

      if (socket?.connected) {
        const result = await new Promise<ChatOfferUpdateResult>((resolve, reject) => {
          socket.emit(
            "offer:update",
            {
              messageId: message.id,
              conversationId: activeConversationId,
              update: { status },
            },
            (response: ChatOfferUpdateResult | { message?: string }) => {
              if (response && "offerMessage" in response) {
                resolve(response);
                return;
              }

              reject(new Error("Could not update the offer."));
            }
          );
        });

        setMessages((current) =>
          current.map((item) => (item.id === result.offerMessage.id ? result.offerMessage : item))
        );
        return;
      }

      const result = await apiRequest<ChatOfferUpdateResult>(
        `/messaging/messages/${message.id}/offer`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      setMessages((current) => [
        ...current.map((item) =>
          item.id === result.offerMessage.id ? result.offerMessage : item
        ),
        result.systemMessage,
      ]);
    } catch (offerError) {
      setError(normalizeApiError(offerError, "Could not update the offer."));
    }
  }

  async function deleteMessage(
    message: ChatMessage,
    scope: "me" | "everyone"
  ) {
    if (!activeConversationId || message.deletedAt) {
      return;
    }

    try {
      setOpenMessageMenuId(null);
      const socket = socketRef.current;

      if (socket?.connected) {
        const deleted = await new Promise<ChatDeleteMessageResult>((resolve, reject) => {
          socket.emit(
            "message:delete",
            {
              messageId: message.id,
              conversationId: activeConversationId,
              scope,
            },
            (response: ChatDeleteMessageResult | { message?: string }) => {
              if (response && "scope" in response) {
                resolve(response);
                return;
              }

              reject(new Error("Could not delete the message."));
            }
          );
        });

        if (deleted.scope === "everyone") {
          setMessages((current) =>
            current.map((item) => (item.id === deleted.message.id ? deleted.message : item))
          );
          patchConversation(activeConversationId, (conversation) => ({
            ...conversation,
            lastMessage:
              conversation.lastMessage?.id === deleted.message.id
                ? deleted.message
                : conversation.lastMessage,
            updatedAt:
              conversation.lastMessage?.id === deleted.message.id
                ? deleted.updatedAt
                : conversation.updatedAt,
          }));
        } else {
          setMessages((current) =>
            current.filter((item) => item.id !== deleted.messageId)
          );
          patchConversation(activeConversationId, (conversation) => ({
            ...conversation,
            lastMessage:
              conversation.lastMessage?.id === deleted.messageId
                ? deleted.lastMessage
                : conversation.lastMessage,
            updatedAt:
              conversation.lastMessage?.id === deleted.messageId
                ? deleted.updatedAt
                : conversation.updatedAt,
          }));
        }
        return;
      }

      const deleted = await apiRequest<ChatDeleteMessageResult>(
        `/messaging/messages/${message.id}?scope=${scope}`,
        {
        method: "DELETE",
      });
      if (deleted.scope === "everyone") {
        setMessages((current) =>
          current.map((item) => (item.id === deleted.message.id ? deleted.message : item))
        );
        patchConversation(activeConversationId, (conversation) => ({
          ...conversation,
          lastMessage:
            conversation.lastMessage?.id === deleted.message.id
              ? deleted.message
              : conversation.lastMessage,
          updatedAt:
            conversation.lastMessage?.id === deleted.message.id
              ? deleted.updatedAt
              : conversation.updatedAt,
        }));
      } else {
        setMessages((current) => current.filter((item) => item.id !== deleted.messageId));
        patchConversation(activeConversationId, (conversation) => ({
          ...conversation,
          lastMessage:
            conversation.lastMessage?.id === deleted.messageId
              ? deleted.lastMessage
              : conversation.lastMessage,
          updatedAt:
            conversation.lastMessage?.id === deleted.messageId
              ? deleted.updatedAt
              : conversation.updatedAt,
        }));
      }
    } catch (deleteError) {
      setError(normalizeApiError(deleteError, "Could not delete that message."));
    }
  }

  function renderMessageBody(message: ChatMessage) {
    if (message.deletedAt) {
      return (
        <p className="italic opacity-80">
          This message was deleted
        </p>
      );
    }

    if (message.type === "SYSTEM") {
      return (
        <div className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-center text-xs font-semibold text-[var(--muted)]">
          {message.body ?? "Conversation updated"}
        </div>
      );
    }

    if (message.type === "LISTING_CARD") {
      const listing = message.listing;

      return (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
            Listing shared
          </p>
          {listing ? (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-[var(--foreground)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{listing.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {listing.currency} {listing.price.toLocaleString()} · {listing.categoryName}
                  </p>
                </div>
                <Link
                  href={`/listings/${listing.id}`}
                  className="text-xs font-bold text-[var(--brand)] underline-offset-2 hover:underline"
                >
                  View listing
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm">{message.body ?? "Listing details shared"}</p>
          )}
        </div>
      );
    }

    if (message.type === "OFFER") {
      const isSeller = activeConversation?.listing?.sellerId === currentUserId;
      const canRespond =
        isSeller &&
        message.senderId !== currentUserId &&
        message.offerStatus === "PENDING" &&
        activeConversation?.canSend;

      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
              Offer
            </p>
            <p className="mt-2 text-lg font-black">
              {message.offerCurrency} {message.offerAmount?.toLocaleString()}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
              {message.offerStatus}
            </p>
          </div>
          {message.body ? <p>{message.body}</p> : null}
          {canRespond ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void updateOfferStatus(message, "ACCEPTED")}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => void updateOfferStatus(message, "DECLINED")}
                className="rounded-md border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-bold"
              >
                Decline
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (message.type === "IMAGE") {
      const image = getImagePayload(message);

      return (
        <div className="space-y-3">
          {image ? (
            <img
              src={image.url}
              alt={image.alt}
              className="max-h-72 w-full rounded-md object-cover"
            />
          ) : null}
          {message.body ? <p>{message.body}</p> : null}
        </div>
      );
    }

    if (message.type === "FILE") {
      const file = getFilePayload(message);

      return (
        <div className="space-y-3">
          {file ? (
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold underline-offset-2 hover:underline"
            >
              {file.name}
            </a>
          ) : null}
          {message.body ? <p>{message.body}</p> : null}
        </div>
      );
    }

    return <p>{message.body}</p>;
  }

  return (
    <div className="messages-workspace grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <aside className="panel messages-sidebar h-fit min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-eyebrow">Inbox</p>
            <h2 className="mt-1.5 text-lg font-black text-[var(--foreground)]">
              Conversations
            </h2>
          </div>
          <div className="messages-segmented-control flex rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setInboxView("active")}
              className={`rounded px-3 py-2 ${
                inboxView === "active"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setInboxView("archived")}
              className={`rounded px-3 py-2 ${
                inboxView === "archived"
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              Archived
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2.5">
          {visibleConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => void openConversation(conversation, inboxView)}
              className={`messages-conversation-card w-full min-w-0 rounded-xl border px-3 py-3 text-left text-sm transition ${
                conversation.id === activeConversationId
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--foreground)]"
                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate font-bold">{conversation.title}</span>
                  <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                    {conversation.listing
                      ? `${conversation.listing.categoryName} · ${conversation.listing.currency} ${conversation.listing.price.toLocaleString()}`
                      : conversation.counterpart?.role ?? "Direct"}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--muted)]">
                  {formatConversationTimestamp(conversation.updatedAt)}
                </span>
              </div>
              <span className="mt-2 block truncate text-[var(--muted)]">
                {messagePreview(conversation.lastMessage, currentUserId)}
              </span>
              <div className="mt-3 flex min-w-0 items-center justify-between gap-2 text-xs text-[var(--muted)]">
                <span className="min-w-0 truncate">
                  {conversation.counterpart
                    ? `${conversation.counterpart.displayName} · ${conversation.counterpart.role}`
                    : "Conversation"}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {conversation.mutedAt ? (
                    <span className="rounded-full border border-[var(--line)] px-2 py-1">
                      Muted
                    </span>
                  ) : null}
                  {conversation.unreadCount ? (
                    <span className="rounded-full bg-[var(--brand)] px-2 py-1 font-bold text-white">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
          {isLoadingConversations ? (
            <div className="messages-placeholder rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-4 py-5 text-sm text-[var(--muted)]">
              Loading conversations...
            </div>
          ) : !visibleConversations.length ? (
            <div className="messages-placeholder rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-4 py-5 text-sm text-[var(--muted)]">
              {inboxView === "active"
                ? "No active conversations yet."
                : "No archived conversations yet."}
            </div>
          ) : null}
        </div>

        {isStaff && staffReports ? (
          <div className="mt-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Staff queue
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {staffReports.conversationReports.length} conversation reports ·{" "}
              {staffReports.messageReports.length} message reports
            </p>
            {staffReports.conversationReports.slice(0, 2).map((report) => (
              <div key={report.id} className="mt-3 text-xs text-[var(--muted)]">
                <span className="font-bold text-[var(--foreground)]">
                  {report.listingTitle ?? "Conversation"}
                </span>
                <span> · {report.reason}</span>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      <section className="panel messages-chat-panel min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-eyebrow">Chat</p>
            <h2 className="mt-1.5 text-lg font-black text-[var(--foreground)]">
              {activeConversation?.title ?? "Select a conversation"}
            </h2>
            {activeCounterpart ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    activeCounterpart.online ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                {activeCounterpart.displayName}
                <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
                  {activeCounterpart.role}
                </span>
                <span>{activeCounterpart.online ? "online" : "offline"}</span>
              </p>
            ) : null}
          </div>
          {activeConversation ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeConversation.listing ? (
                <button
                  type="button"
                  onClick={() => void shareListingCard()}
                  className="action-secondary px-3 py-2 text-xs font-bold"
                >
                  Share listing card
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  void togglePreference({ archived: !Boolean(activeConversation.archivedAt) })
                }
                className="action-secondary px-3 py-2 text-xs font-bold"
              >
                {activeConversation.archivedAt ? "Unarchive" : "Archive"}
              </button>
              <button
                type="button"
                onClick={() =>
                  void togglePreference({ muted: !Boolean(activeConversation.mutedAt) })
                }
                className="action-secondary px-3 py-2 text-xs font-bold"
              >
                {activeConversation.mutedAt ? "Unmute" : "Mute"}
              </button>
              {!activeConversation.blockedByMe && activeCounterpart && !isStaffRole(activeCounterpart.role) ? (
                <button
                  type="button"
                  onClick={() => void blockCounterpart()}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                >
                  Block user
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void reportConversation()}
                className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold text-[var(--muted)]"
              >
                Report
              </button>
            </div>
          ) : null}
        </div>

        {activeConversation?.listing ? (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {activeConversation.listing.primaryImageUrl ? (
                  <img
                    src={activeConversation.listing.primaryImageUrl}
                    alt={activeConversation.listing.title}
                    className="h-20 w-20 rounded-md object-cover"
                  />
                ) : null}
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Listing conversation
                  </p>
                  <h3 className="mt-2 text-lg font-black text-[var(--foreground)]">
                    {activeConversation.listing.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {activeConversation.listing.currency}{" "}
                    {activeConversation.listing.price.toLocaleString()} ·{" "}
                    {activeConversation.listing.categoryName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {activeConversation.listing.location}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {activeConversation.listing.status}
                </span>
                <Link
                  href={`/listings/${activeConversation.listing.id}`}
                  className="action-secondary px-3 py-2 text-sm font-bold"
                >
                  View listing
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {!activeConversation?.canSend && activeConversation?.sendDisabledReason ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {activeConversation.sendDisabledReason}
          </div>
        ) : null}

        <div className="messages-thread mt-4 h-[30rem] space-y-3 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3.5">
          {messages.map((message) => {
            const mine = message.senderId === currentUserId;
            const isSystem = message.type === "SYSTEM";
            const isDeleted = Boolean(message.deletedAt);
            const isTemp = message.id.startsWith("temp-");
            const canDeleteMine = mine && !isSystem && !isDeleted && !isTemp;
            const allowDeleteForEveryone = canDeleteMine && canDeleteForEveryone(message, currentUserId);

            return (
              <div
                key={message.id}
                className={`flex ${isSystem ? "justify-center" : mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-md px-4 py-3 text-sm shadow-sm ${
                    isSystem
                      ? "bg-transparent p-0 shadow-none"
                      : isDeleted
                        ? "border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
                      : mine
                        ? "bg-[var(--brand)] text-white"
                        : "border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)]"
                  }`}
                >
                  {renderMessageBody(message)}
                  {!isSystem ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] opacity-70">
                      <span>
                        {message.senderName} · {formatMessageTimestamp(message.createdAt)}
                      </span>
                      <div className="flex items-center gap-3">
                        {mine ? (
                          <>
                            <span>
                              {isDeleted
                                ? "Deleted"
                                : isTemp
                                  ? "Sending…"
                                  : message.readBy.some(
                                        (receipt) => receipt.userId !== currentUserId
                                      )
                                    ? "Read"
                                    : "Delivered"}
                            </span>
                            {canDeleteMine ? (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMessageMenuId((current) =>
                                      current === message.id ? null : message.id
                                    )
                                  }
                                  className="rounded px-2 py-1 font-semibold hover:bg-black/10 hover:text-current"
                                  aria-label="Open message actions"
                                >
                                  ⋯
                                </button>
                                {openMessageMenuId === message.id ? (
                                  <div className="absolute right-0 top-full z-10 mt-2 min-w-40 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1 text-left text-[12px] text-[var(--foreground)] shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => void deleteMessage(message, "me")}
                                      className="block w-full rounded px-3 py-2 text-left hover:bg-[var(--surface-strong)]"
                                    >
                                      Delete for me
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteMessage(message, "everyone")}
                                      disabled={!allowDeleteForEveryone}
                                      className="block w-full rounded px-3 py-2 text-left hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
                                      title={
                                        allowDeleteForEveryone
                                          ? "Delete for everyone"
                                          : "Delete for everyone is available for 15 minutes after sending"
                                      }
                                    >
                                      Delete for everyone
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {!mine && message.type !== "SYSTEM" && !isDeleted ? (
                          <button
                            type="button"
                            onClick={() => void reportMessage(message.id)}
                            className="font-semibold underline-offset-2 hover:underline"
                          >
                            Report
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {typingUser ? (
            <div className="text-xs font-semibold text-[var(--muted)]">
              {typingUser} is typing...
            </div>
          ) : null}
          {isLoadingConversations ? (
            <div className="messages-placeholder rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-7 text-sm text-[var(--muted)]">
              Loading messages...
            </div>
          ) : !messages.length ? (
            <div className="messages-placeholder rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-7 text-sm text-[var(--muted)]">
              Open a listing and start a conversation.
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {lastOwnMessage ? (
          <p className="mt-3 text-xs font-medium text-[var(--muted)]">
            Latest message status:{" "}
            {lastOwnMessageRead ? "Read" : lastOwnMessage.id.startsWith("temp-") ? "Sending" : "Delivered"}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setComposerMode("TEXT")}
            className={`rounded-md px-3 py-2 text-xs font-bold ${
              composerMode === "TEXT"
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]"
            }`}
          >
            Text
          </button>
          {activeConversation?.listing ? (
            <button
              type="button"
              onClick={() => {
                setComposerMode("OFFER");
                setOfferCurrency(activeConversation.listing?.currency ?? "AED");
              }}
              className={`rounded-md px-3 py-2 text-xs font-bold ${
                composerMode === "OFFER"
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]"
              }`}
            >
              Offer
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setComposerMode("IMAGE")}
            className={`rounded-md px-3 py-2 text-xs font-bold ${
              composerMode === "IMAGE"
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]"
            }`}
          >
            Image URL
          </button>
        </div>

        {composerMode === "OFFER" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
            <input
              value={offerAmount}
              onChange={(event) => setOfferAmount(event.target.value)}
              className="surface-input px-3 py-2 text-sm"
              placeholder="Offer amount"
              inputMode="decimal"
            />
            <input
              value={offerCurrency}
              onChange={(event) => setOfferCurrency(event.target.value)}
              className="surface-input px-3 py-2 text-sm uppercase"
              placeholder="Currency"
            />
          </div>
        ) : null}

        {composerMode === "IMAGE" ? (
          <div className="mt-3">
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className="surface-input w-full px-3 py-2 text-sm"
              placeholder="https://example.com/image.jpg"
            />
          </div>
        ) : null}

        <div className="messages-composer mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            className="surface-input flex-1 px-3 py-2 text-sm"
            placeholder={
              composerMode === "OFFER"
                ? "Optional note for your offer"
                : composerMode === "IMAGE"
                  ? "Optional caption"
                  : "Type a message"
            }
            disabled={!activeConversation || !activeConversation.canSend || isSending}
          />
          <button
            type="button"
            onClick={() => void sendComposerMessage()}
            disabled={!activeConversation || !activeConversation.canSend || isSending}
            className="action-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Sending..." : composerMode === "OFFER" ? "Send offer" : "Send"}
          </button>
        </div>
      </section>
    </div>
  );
}
