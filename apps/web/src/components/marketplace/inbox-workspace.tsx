"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import {
  type AdminChatUser,
  type ChatConversation,
  type ChatMessage,
  type ChatMessageType,
} from "@/lib/messaging-api";
import { mapListing, type ApiListing } from "@/lib/marketplace";

type InboxWorkspaceProps = {
  accessToken: string;
  apiBaseUrl: string;
  currentUserId: string;
  currentUserRole: string;
  selectedConversationId?: string | null;
  selectedListingId?: string;
  selectedParticipantId?: string;
};

type SendMessageInput = {
  type: ChatMessageType;
  body?: string;
  payload?: Record<string, unknown>;
  listingId?: string;
  offerAmount?: number;
  offerCurrency?: string;
};

const maxAttachmentSize = 5 * 1024 * 1024;

async function compressImage(file: File) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);

  return {
    name: file.name,
    mimeType: "image/jpeg",
    src: canvas.toDataURL("image/jpeg", 0.72),
  };
}

async function readFileAttachment(file: File) {
  if (file.size > maxAttachmentSize) {
    throw new Error("Files must be 5 MB or smaller.");
  }

  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    src,
  };
}

function formatFileSize(size: unknown) {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return "";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    selectedConversationId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentListings, setRecentListings] = useState<Array<{ id: string; title: string }>>([]);
  const [adminChatUsers, setAdminChatUsers] = useState<AdminChatUser[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [draftMessage, setDraftMessage] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    new Set()
  );
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId
  );
  const activeOtherParticipant = activeConversation?.participants.find(
    (participant) => participant.userId !== currentUserId
  );
  const canStartUserChats =
    adminChatUsers.length > 0;
  const userChatLabel =
    currentUserRole.toUpperCase() === "ADMIN" ? "Admin user chat" : "Admin support chat";
  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    return names.length ? `${names.join(", ")} typing...` : "";
  }, [typingUsers]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const socket = io(`${apiBaseUrl}/messaging`, {
      auth: {
        token: accessToken,
      },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const conversationId = activeConversationIdRef.current;

      if (conversationId) {
        socket.emit("conversation:join", { conversationId });
        socket.emit("message:read", { conversationId });
      }
    });
    socket.on("presence:update", (event: { onlineUserIds?: string[] }) => {
      setOnlineUserIds(new Set(event.onlineUserIds ?? []));
    });
    socket.on("message:new", (message: ChatMessage) => {
      const activeId = activeConversationIdRef.current;

      if (message.conversationId === activeId) {
        setMessages((current) => {
          if (current.some((item) => item.id === message.id)) {
            return current;
          }

          const optimisticIndex = current.findIndex(
            (item) =>
              item.id.startsWith("optimistic-") &&
              item.senderId === message.senderId &&
              item.type === message.type &&
              item.body === message.body
          );

          if (optimisticIndex === -1) {
            return [...current, message];
          }

          return current.map((item, index) =>
            index === optimisticIndex ? message : item
          );
        });
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                lastMessage: message,
                unreadCount:
                  conversation.id === activeId || message.senderId === currentUserId
                    ? 0
                    : conversation.unreadCount + 1,
              }
            : conversation
        )
      );
    });
    socket.on("typing:update", (event: {
      conversationId: string;
      userId: string;
      displayName: string;
      typing: boolean;
    }) => {
      if (
        event.conversationId !== activeConversationIdRef.current ||
        event.userId === currentUserId
      ) {
        return;
      }

      setTypingUsers((current) => {
        const next = { ...current };

        if (event.typing) {
          next[event.userId] = event.displayName;
        } else {
          delete next[event.userId];
        }

        return next;
      });
    });
    socket.on("offer:updated", (message: ChatMessage) => {
      if (message.conversationId === activeConversationIdRef.current) {
        setMessages((current) =>
          current.map((item) => (item.id === message.id ? message : item))
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, apiBaseUrl, currentUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoadingWorkspace(true);

      try {
        const contactsPath =
          currentUserRole.toUpperCase() === "ADMIN"
            ? "/users/admin/chat-users"
            : "/users/support/admins";

        const [loadedConversations, loadedContacts, loadedListings] = await Promise.all([
          apiRequest<ChatConversation[]>("/messaging/conversations"),
          apiRequest<AdminChatUser[]>(contactsPath),
          apiRequest<ApiListing[]>("/listings?take=8")
            .then((items) =>
              items.map((item) => {
                const listing = mapListing(item);
                return { id: listing.id, title: listing.title };
              })
            )
            .catch(() => []),
        ]);

        let selectedConversation: ChatConversation | null = null;

        if (selectedParticipantId) {
          selectedConversation = await apiRequest<ChatConversation>(
            "/messaging/conversations",
            {
              method: "POST",
              body: JSON.stringify({ participantId: selectedParticipantId }),
            }
          ).catch(() => null);
        } else if (selectedListingId) {
          selectedConversation = await apiRequest<ChatConversation>(
            "/messaging/conversations",
            {
              method: "POST",
              body: JSON.stringify({ listingId: selectedListingId }),
            }
          ).catch(() => null);
        } else if (selectedConversationId) {
          selectedConversation =
            loadedConversations.find((conversation) => conversation.id === selectedConversationId) ??
            null;
        } else {
          selectedConversation = loadedConversations[0] ?? null;
        }

        const nextConversations = selectedConversation
          ? [
              selectedConversation,
              ...loadedConversations.filter(
                (conversation) => conversation.id !== selectedConversation.id
              ),
            ]
          : loadedConversations;

        const nextMessages = selectedConversation
          ? await apiRequest<ChatMessage[]>(
              `/messaging/conversations/${selectedConversation.id}/messages`
            ).catch(() => [])
          : [];

        if (cancelled) {
          return;
        }

        setConversations(nextConversations);
        setAdminChatUsers(loadedContacts);
        setRecentListings(loadedListings);
        setOnlineUserIds(
          new Set(
            nextConversations.flatMap((item) =>
              item.participants.filter((p) => p.online).map((p) => p.userId)
            )
          )
        );
        setActiveConversationId(selectedConversation?.id ?? null);
        setMessages(nextMessages);
      } finally {
        if (!cancelled) {
          setLoadingWorkspace(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    apiBaseUrl,
    currentUserRole,
    selectedConversationId,
    selectedListingId,
    selectedParticipantId,
  ]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    socketRef.current?.emit("conversation:join", { conversationId: activeConversationId });
    socketRef.current?.emit("message:read", { conversationId: activeConversationId });
  }, [activeConversationId]);

  async function apiRequest<T>(path: string, init: RequestInit = {}) {
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
  }

  async function openConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    activeConversationIdRef.current = conversationId;
    socketRef.current?.emit("conversation:join", { conversationId });
    socketRef.current?.emit("message:read", { conversationId });
    const nextMessages = await apiRequest<ChatMessage[]>(
      `/messaging/conversations/${conversationId}/messages`
    );
    setMessages(nextMessages);
    setTypingUsers({});
  }

  async function sendMessage(input: SendMessageInput) {
    if (!activeConversationId) {
      return;
    }

    if (input.type === "TEXT" && !input.body?.trim()) {
      return;
    }

    setSendingMessage(true);
    const conversationId = activeConversationId;
    const now = new Date().toISOString();
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      conversationId,
      senderId: currentUserId,
      senderName: "You",
      type: input.type,
      body: input.body?.trim() || null,
      payload: input.payload ?? null,
      listingId: input.listingId ?? null,
      listing: null,
      offerAmount: input.offerAmount ?? null,
      offerCurrency: input.offerCurrency ?? null,
      offerStatus: input.type === "OFFER" ? "PENDING" : null,
      createdAt: now,
      updatedAt: now,
    };

    setMessages((current) => [...current, optimisticMessage]);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, lastMessage: optimisticMessage, unreadCount: 0 }
          : conversation
      )
    );
    setDraftMessage("");

    const socket = socketRef.current;

    try {
      const message =
        socket?.connected
          ? await new Promise<ChatMessage>((resolve, reject) => {
              socket
                .timeout(10000)
                .emit(
                  "message:send",
                  {
                    conversationId,
                    message: input,
                  },
                  (error: Error | null, response: ChatMessage) => {
                    if (error) {
                      reject(error);
                    } else {
                      resolve(response);
                    }
                  }
                );
            })
          : await apiRequest<ChatMessage>(
              `/messaging/conversations/${conversationId}/messages`,
              {
                method: "POST",
                body: JSON.stringify(input),
              }
            );

      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current.filter((item) => item.id !== optimisticId)
          : current.map((item) => (item.id === optimisticId ? message : item))
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastMessage: message, unreadCount: 0 }
            : conversation
        )
      );
    } catch {
      const latestMessages = await apiRequest<ChatMessage[]>(
        `/messaging/conversations/${conversationId}/messages`
      ).catch(() => null);

      if (latestMessages) {
        setMessages(latestMessages);
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  lastMessage: latestMessages[latestMessages.length - 1] ?? null,
                  unreadCount: 0,
                }
              : conversation
          )
        );
        return;
      }

      setMessages((current) => current.filter((item) => item.id !== optimisticId));
    } finally {
      setSendingMessage(false);
    }
  }

  function handleDraftChange(value: string) {
    setDraftMessage(value);

    if (!activeConversationId) {
      return;
    }

    socketRef.current?.emit("typing:start", { conversationId: activeConversationId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { conversationId: activeConversationId });
    }, 800);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAttachmentError("");
    const compressed = await compressImage(file);
    await sendMessage({
      type: "IMAGE",
      payload: compressed,
    });
    event.target.value = "";
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setAttachmentError("");
      const attachment = await readFileAttachment(file);
      await sendMessage({
        type: "FILE",
        payload: attachment,
      });
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : "Could not attach this file."
      );
    } finally {
      event.target.value = "";
    }
  }

  async function updateOffer(messageId: string, status: "ACCEPTED" | "DECLINED") {
    if (!activeConversationId) {
      return;
    }

    const socket = socketRef.current;
    const message =
      socket?.connected
        ? await new Promise<ChatMessage>((resolve, reject) => {
            socket
              .timeout(5000)
              .emit(
                "offer:update",
                {
                  conversationId: activeConversationId,
                  messageId,
                  update: { status },
                },
                (error: Error | null, response: ChatMessage) => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(response);
                  }
                }
              );
          })
        : await apiRequest<ChatMessage>(`/messaging/messages/${messageId}/offer`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
          });

    setMessages((current) =>
      current.map((item) => (item.id === message.id ? message : item))
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.32fr_0.68fr]">
      <aside className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.85)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Inbox
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              Conversations
            </h2>
          </div>
          <span className="rounded-full bg-[rgba(31,107,90,0.1)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            {conversations.length}
          </span>
        </div>

        <div className="space-y-3">
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            const participant = conversation.participants.find(
              (item) => item.userId !== currentUserId
            );
            const online = participant ? onlineUserIds.has(participant.userId) : false;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void openConversation(conversation.id)}
                className={`block w-full rounded-[1.5rem] border p-4 text-left ${
                  active
                    ? "border-transparent bg-[var(--foreground)] text-[var(--surface)]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        online ? "bg-[#26b36a]" : "bg-[var(--line)]"
                      }`}
                    />
                    {participant?.displayName ?? conversation.title}
                  </span>
                  {conversation.unreadCount > 0 ? (
                    <span className="rounded-full bg-[#d95d39] px-2 py-0.5 text-xs font-bold text-white">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm opacity-80">{conversation.title}</p>
                <p className="mt-2 line-clamp-1 text-xs opacity-70">
                  {conversation.lastMessage?.body ??
                    (conversation.lastMessage?.type === "FILE" &&
                    typeof conversation.lastMessage.payload?.name === "string"
                      ? conversation.lastMessage.payload.name
                      : conversation.lastMessage?.type) ??
                    "No messages yet"}
                </p>
              </button>
            );
          })}

          {recentListings.length ? (
            <div className="pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Start from listing
              </p>
              {recentListings.slice(0, 3).map((listing) => (
                <Link
                  key={listing.id}
                  href={`/messages?listing=${listing.id}`}
                  className="mt-2 block rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--foreground)]"
                >
                  {listing.title}
                </Link>
              ))}
            </div>
          ) : null}

          {canStartUserChats ? (
            <div className="pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {userChatLabel}
              </p>
              {adminChatUsers.slice(0, 8).map((chatUser) => (
                <Link
                  key={chatUser.id}
                  href={`/messages?user=${chatUser.id}`}
                  className="mt-2 block rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--foreground)]"
                >
                  <span className="block font-semibold">{chatUser.displayName}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {chatUser.email} - {chatUser.role}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </aside>

      <section className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.85)] p-6">
        {activeConversation ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div>
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  {activeOtherParticipant?.displayName ?? "Conversation"}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {activeConversation.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {currentUserRole.toUpperCase() === "ADMIN"
                      ? "Admin direct conversation"
                    : activeOtherParticipant
                      ? onlineUserIds.has(activeOtherParticipant.userId)
                        ? "Online now"
                        : "Offline - push fallback will be queued"
                      : "Secure marketplace conversation"}
                </p>
              </div>

              {activeConversation.listing ? (
                <div className="rounded-[1.5rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
                  {activeConversation.listing.currency}{" "}
                  {activeConversation.listing.price.toLocaleString()} ·{" "}
                  {activeConversation.listing.categoryName}
                </div>
              ) : null}
            </div>

            <div className="mt-6 h-[34rem] space-y-4 overflow-y-auto pr-2">
              {messages.map((message) => {
                const mine = message.senderId === currentUserId;
                const imageSrc =
                  typeof message.payload?.src === "string" ? message.payload.src : null;
                const fileName =
                  typeof message.payload?.name === "string" ? message.payload.name : "Attachment";
                const fileMimeType =
                  typeof message.payload?.mimeType === "string"
                    ? message.payload.mimeType
                    : "application/octet-stream";
                const fileSize = formatFileSize(message.payload?.size);

                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[34rem] rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${
                        mine
                          ? "bg-[var(--foreground)] text-[var(--surface)]"
                          : "bg-[rgba(31,107,90,0.08)] text-[var(--foreground)]"
                      }`}
                    >
                      {message.type === "IMAGE" && imageSrc ? (
                        <img
                          src={imageSrc}
                          alt="Shared chat upload"
                          className="max-h-72 rounded-[1rem] object-cover"
                        />
                      ) : null}
                      {message.type === "FILE" && imageSrc ? (
                        <a
                          href={imageSrc}
                          download={fileName}
                          className={`block rounded-[1rem] border px-4 py-3 transition hover:-translate-y-0.5 ${
                            mine
                              ? "border-white/20 bg-white/10 hover:bg-white/15"
                              : "border-[var(--line)] bg-white hover:bg-[rgba(31,107,90,0.06)]"
                          }`}
                        >
                          <span className="block font-semibold">{fileName}</span>
                          <span className="mt-1 block text-xs opacity-75">
                            {fileMimeType}
                            {fileSize ? ` - ${fileSize}` : ""}
                          </span>
                        </a>
                      ) : null}
                      {message.type === "LISTING_CARD" && message.listing ? (
                        <div className="rounded-[1rem] bg-white/20 p-3">
                          <p className="font-semibold">{message.listing.title}</p>
                          <p className="text-xs opacity-75">
                            {message.listing.currency}{" "}
                            {message.listing.price.toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                      {message.type === "OFFER" ? (
                        <div>
                          <p className="font-semibold">
                            Offer: {message.offerCurrency}{" "}
                            {message.offerAmount?.toLocaleString()}
                          </p>
                          <p className="text-xs uppercase tracking-[0.16em] opacity-75">
                            {message.offerStatus}
                          </p>
                          {!mine && message.offerStatus === "PENDING" ? (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => void updateOffer(message.id, "ACCEPTED")}
                                className="rounded-full bg-[#1f6b5a] px-3 py-1 text-xs font-semibold text-white"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => void updateOffer(message.id, "DECLINED")}
                                className="rounded-full bg-[#b93820] px-3 py-1 text-xs font-semibold text-white"
                              >
                                Decline
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {message.body ? <p>{message.body}</p> : null}
                      <p className="mt-2 text-xs opacity-70">
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {typingLabel ? (
                <p className="text-sm italic text-[var(--muted)]">{typingLabel}</p>
              ) : null}
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-[var(--line)] bg-white p-4">
              <textarea
                value={draftMessage}
                onChange={(event) => handleDraftChange(event.target.value)}
                className="min-h-24 w-full resize-none bg-transparent text-sm outline-none"
                placeholder="Type a message..."
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                    Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleImageUpload(event)}
                      className="hidden"
                    />
                  </label>
                  <label className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    File
                    <input
                      type="file"
                      onChange={(event) => void handleFileUpload(event)}
                      className="hidden"
                    />
                  </label>
                  {activeConversation.listingId ? (
                    <button
                      type="button"
                      onClick={() =>
                        void sendMessage({
                          type: "LISTING_CARD",
                          listingId: activeConversation.listingId ?? undefined,
                        })
                      }
                      className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)]"
                    >
                      Listing card
                    </button>
                  ) : null}
                  <input
                    value={offerAmount}
                    onChange={(event) => setOfferAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="Offer amount"
                    className="w-32 rounded-full border border-[var(--line)] px-3 py-2 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const amount = Number(offerAmount);

                      if (Number.isFinite(amount) && amount > 0) {
                        void sendMessage({
                          type: "OFFER",
                          offerAmount: amount,
                          offerCurrency: activeConversation.listing?.currency ?? "AED",
                        });
                        setOfferAmount("");
                      }
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)]"
                  >
                    Offer
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void sendMessage({
                      type: "TEXT",
                      body: draftMessage,
                    })
                  }
                  disabled={!draftMessage.trim() || sendingMessage}
                  className="rounded-full bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#f08a49]/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                >
                  {sendingMessage ? "Sending..." : "Send"}
                </button>
              </div>
              {attachmentError ? (
                <p className="mt-3 text-xs font-semibold text-[#b93820]">
                  {attachmentError}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">
            {loadingWorkspace
              ? "Loading conversations..."
              : "Open a listing and choose messages to start a secure conversation."}
          </div>
        )}
      </section>
    </div>
  );
}
