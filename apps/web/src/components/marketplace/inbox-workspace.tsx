"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  type ChatConversation,
  type ChatMessage,
} from "@/lib/messaging-api";

type InboxWorkspaceProps = {
  accessToken: string;
  apiBaseUrl: string;
  currentUserId: string;
  currentUserRole: string;
  selectedConversationId?: string | null;
  selectedListingId?: string;
  selectedParticipantId?: string;
};

export function InboxWorkspace({
  accessToken,
  apiBaseUrl,
  currentUserId,
  selectedConversationId = null,
  selectedListingId,
  selectedParticipantId,
}: InboxWorkspaceProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    selectedConversationId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<string | null>(activeConversationId);

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
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message]
        );
      }
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === message.conversationId
            ? { ...conversation, lastMessage: message }
            : conversation
        )
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");

      try {
        const loaded = await apiRequest<ChatConversation[]>("/messaging/conversations");
        let active =
          selectedConversationId
            ? loaded.find((conversation) => conversation.id === selectedConversationId) ?? null
            : loaded[0] ?? null;

        if (selectedListingId) {
          active = await apiRequest<ChatConversation>("/messaging/conversations", {
            method: "POST",
            body: JSON.stringify({ listingId: selectedListingId }),
          });
        } else if (selectedParticipantId) {
          active = await apiRequest<ChatConversation>("/messaging/conversations", {
            method: "POST",
            body: JSON.stringify({ participantId: selectedParticipantId }),
          });
        }

        const nextConversations = active
          ? [active, ...loaded.filter((conversation) => conversation.id !== active?.id)]
          : loaded;
        const nextMessages = active
          ? await apiRequest<ChatMessage[]>(
              `/messaging/conversations/${active.id}/messages`
            )
          : [];

        if (cancelled) {
          return;
        }

        setConversations(nextConversations);
        setActiveConversationId(active?.id ?? null);
        setMessages(nextMessages);
        if (active) {
          socketRef.current?.emit("conversation:join", { conversationId: active.id });
        }
      } catch {
        if (!cancelled) {
          setError("Could not load conversations.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, selectedListingId, selectedParticipantId]);

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
    activeIdRef.current = conversationId;
    socketRef.current?.emit("conversation:join", { conversationId });
    setMessages(await apiRequest<ChatMessage[]>(`/messaging/conversations/${conversationId}/messages`));
  }

  async function sendMessage() {
    const body = draft.trim();

    if (!body || !activeConversationId) {
      return;
    }

    setDraft("");

    const payload = {
      conversationId: activeConversationId,
      message: {
        type: "TEXT",
        body,
      },
    };
    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit("message:send", payload);
      return;
    }

    const message = await apiRequest<ChatMessage>(
      `/messaging/conversations/${activeConversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload.message),
      }
    );
    setMessages((current) => [...current, message]);
  }

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="panel h-fit">
        <h2 className="font-semibold">Conversations</h2>
        <div className="mt-3 grid gap-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => void openConversation(conversation.id)}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                conversation.id === activeConversationId
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--foreground)]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="block font-semibold">{conversation.title}</span>
              <span className="block truncate opacity-80">
                {conversation.lastMessage?.body ?? "No messages yet"}
              </span>
            </button>
          ))}
          {!conversations.length ? (
            <p className="text-sm text-slate-600">No conversations yet.</p>
          ) : null}
        </div>
      </aside>

      <section className="panel">
        <h2 className="font-semibold">{activeConversation?.title ?? "Chat"}</h2>
        <div className="mt-4 h-96 space-y-3 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
          {messages.map((message) => {
            const mine = message.senderId === currentUserId;

            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-md px-3 py-2 text-sm ${mine ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--foreground)]"}`}>
                  <p>{message.body}</p>
                  <p className="mt-1 text-xs opacity-70">{message.senderName}</p>
                </div>
              </div>
            );
          })}
          {!messages.length ? (
            <p className="text-sm text-slate-600">Open a listing and start a conversation.</p>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Type a message"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            className="action-primary px-4 py-2 text-sm font-semibold"
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
