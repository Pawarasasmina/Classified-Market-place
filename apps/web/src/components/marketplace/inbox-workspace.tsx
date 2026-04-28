"use client";

import { useMemo, useState } from "react";
import {
  conversations,
  currentUser,
  getListingById,
  getSellerById,
} from "@/lib/phase1-data";

export function InboxWorkspace() {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [draftMessage, setDraftMessage] = useState("");

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId),
    [selectedId]
  );

  const listing = selected ? getListingById(selected.listingId) : undefined;
  const seller = selected ? getSellerById(selected.sellerId) : undefined;

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
            {conversations.length} active
          </span>
        </div>

        <div className="space-y-3">
          {conversations.map((conversation) => {
            const conversationListing = getListingById(conversation.listingId);
            const conversationSeller = getSellerById(conversation.sellerId);
            const active = conversation.id === selectedId;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={`w-full rounded-[1.5rem] border p-4 text-left ${
                  active
                    ? "border-transparent bg-[var(--foreground)] text-[var(--surface)]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {conversationSeller?.name ?? "Seller"}
                  </p>
                  <span className="text-xs opacity-70">{conversation.updatedAt}</span>
                </div>
                <p className="mt-2 text-sm opacity-80">
                  {conversationListing?.title}
                </p>
                <p className="mt-2 text-sm opacity-70">
                  {conversation.messages[conversation.messages.length - 1]?.body}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.85)] p-6">
        {selected && listing && seller ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div>
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  Active thread
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {listing.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Chatting with {seller.name} • {seller.responseRate} response rate
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
                Listing card share supported • unread {selected.unreadCount}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {selected.messages.map((message) => {
                const mine = message.senderId === currentUser.id;

                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[32rem] rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${
                        mine
                          ? "bg-[var(--foreground)] text-[var(--surface)]"
                          : "bg-[rgba(31,107,90,0.08)] text-[var(--foreground)]"
                      }`}
                    >
                      <p>{message.body}</p>
                      <p className="mt-2 text-xs opacity-70">{message.sentAt}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-[var(--line)] bg-white p-4">
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                className="min-h-28 w-full resize-none bg-transparent text-sm outline-none"
                placeholder="Type a message, request a viewing, or make an offer..."
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {["Request viewing", "Make offer", "Share listing card"].map(
                    (label) => (
                      <span
                        key={label}
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]"
                      >
                        {label}
                      </span>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDraftMessage("")}
                  className="rounded-full bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-3 text-sm font-semibold text-white"
                >
                  Send message
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">
            Select a conversation to start messaging.
          </div>
        )}
      </section>
    </div>
  );
}
