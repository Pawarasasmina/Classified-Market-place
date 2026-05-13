"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markConversationReadAction,
  sendConversationMessageAction,
} from "@/app/(main)/actions";
import {
  type FormActionState,
  type MarketplaceConversation,
  type MarketplaceListing,
} from "@/lib/marketplace";

type InboxWorkspaceProps = {
  currentUserId: string;
  conversations: MarketplaceConversation[];
  selectedConversation?: MarketplaceConversation | null;
  selectedListing?: MarketplaceListing | null;
};

const initialState: FormActionState = {
  message: null,
};

function buildQuickReply(template: string, listingTitle: string) {
  switch (template) {
    case "Request viewing":
      return `Hi, I would like to arrange a viewing for "${listingTitle}". What time works for you?`;
    case "Make offer":
      return `Hi, I am interested in "${listingTitle}". Is the price negotiable?`;
    case "Share listing card":
      return `Hi, I am sharing "${listingTitle}" with someone else and may get back to you shortly.`;
    default:
      return "";
  }
}

export function InboxWorkspace({
  currentUserId,
  conversations,
  selectedConversation,
  selectedListing,
}: InboxWorkspaceProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    sendConversationMessageAction,
    initialState
  );
  const [draftMessage, setDraftMessage] = useState("");
  const selectedKey = selectedConversation?.id ?? selectedListing?.id ?? "empty";
  const selectedListingTitle = selectedConversation?.listing.title ?? selectedListing?.title ?? "";
  const selectedListingOwnedByCurrentUser = selectedListing?.sellerId === currentUserId;

  useEffect(() => {
    setDraftMessage("");
  }, [selectedKey]);

  useEffect(() => {
    if (!selectedConversation || selectedConversation.unreadCount < 1) {
      return;
    }

    startTransition(async () => {
      try {
        await markConversationReadAction(
          selectedConversation.id,
          `/messages?conversation=${selectedConversation.id}`
        );
        router.refresh();
      } catch {
        // Ignore read-sync failures so the inbox remains usable.
      }
    });
  }, [router, selectedConversation]);

  const selectedConversationHref = selectedConversation
    ? `/messages?conversation=${selectedConversation.id}`
    : selectedListing
      ? `/messages?listing=${selectedListing.id}`
      : "/messages";

  const quickReplyLabels = ["Request viewing", "Make offer", "Share listing card"];
  const canSend =
    Boolean(selectedConversation || selectedListing) &&
    (!selectedListingOwnedByCurrentUser || Boolean(selectedConversation));

  return (
    <div className="grid gap-6 xl:grid-cols-[0.32fr_0.68fr]">
      <aside className="rounded-[2rem] border border-[var(--line)] bg-[rgba(32,39,85,0.9)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Inbox
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              Active conversations
            </h2>
          </div>
          <span className="rounded-full bg-[rgba(102,104,232,0.2)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
            {conversations.length} live
          </span>
        </div>

        <div className="space-y-3">
          {!selectedConversation && selectedListing ? (
            <Link
              href={selectedConversationHref}
              className="block rounded-[1.5rem] border border-transparent bg-[var(--brand)] p-4 text-[var(--foreground)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{selectedListing.subcategory}</p>
                <span className="text-xs opacity-70">New chat</span>
              </div>
              <p className="mt-2 text-sm opacity-80">{selectedListing.title}</p>
              <p className="mt-2 text-sm opacity-70">{selectedListing.priceLabel}</p>
            </Link>
          ) : null}

          {conversations.length ? (
            conversations.map((conversation) => {
              const active = conversation.id === selectedConversation?.id;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages?conversation=${conversation.id}`}
                  className={`block rounded-[1.5rem] border p-4 text-left ${
                    active
                      ? "border-transparent bg-[var(--brand)] text-[var(--foreground)]"
                      : "border-[var(--line)] bg-[var(--surface-strong)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {conversation.counterpartName}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] opacity-70">
                        {conversation.listing.subcategory}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs opacity-70">
                        {conversation.updatedLabel}
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <div className="mt-2 inline-flex rounded-full bg-[rgba(240,138,73,0.2)] px-2 py-1 text-[11px] font-semibold">
                          {conversation.unreadCount} new
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 text-sm opacity-80">{conversation.listing.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm opacity-70">
                    {conversation.latestMessagePreview}
                  </p>
                </Link>
              );
            })
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-4 py-6 text-sm text-[var(--muted)]">
              No conversations yet. Open a listing and send the first message to
              start your inbox history.
            </div>
          )}
        </div>
      </aside>

      <section className="rounded-[2rem] border border-[var(--line)] bg-[rgba(32,39,85,0.9)] p-6">
        {selectedConversation || selectedListing ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div>
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  {selectedConversation ? "Live conversation" : "Listing outreach"}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {selectedConversation?.listing.title ?? selectedListing?.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {selectedConversation
                    ? `Chatting with ${selectedConversation.counterpartName}${
                        selectedConversation.counterpartVerified ? " - verified" : ""
                      }`
                    : selectedListingOwnedByCurrentUser
                      ? "This is your listing. Buyer conversations will appear here as messages arrive."
                      : `Seller: ${
                          selectedListing?.sellerDisplayName ?? "Marketplace seller"
                        }${selectedListing?.sellerVerified ? " - verified" : ""}`}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                {selectedConversation
                  ? `${selectedConversation.viewerRole} view • ${selectedConversation.latestMessageSentLabel}`
                  : selectedListingOwnedByCurrentUser
                    ? "Waiting for the first buyer message"
                    : "Ready to start a new conversation"}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {selectedConversation?.messages.length ? (
                selectedConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[32rem] rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${
                        message.mine
                          ? "bg-[var(--brand)] text-[var(--foreground)]"
                          : "bg-[rgba(9,12,26,0.55)] text-[var(--foreground)]"
                      }`}
                    >
                      <p>{message.body}</p>
                      <p className="mt-2 text-xs opacity-70">
                        {message.mine
                          ? `You • ${message.sentLabel}`
                          : `${message.senderDisplayName} • ${message.sentLabel}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-5 py-8 text-sm leading-7 text-[var(--muted)]">
                  {selectedListingOwnedByCurrentUser
                    ? "No buyer messages have reached this listing yet."
                    : `No messages have been sent for "${selectedListingTitle}" yet. Write the first one below to open the conversation.`}
                </div>
              )}
            </div>

            <form action={formAction} className="mt-6 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
              <input
                type="hidden"
                name="conversationId"
                value={selectedConversation?.id ?? ""}
              />
              <input
                type="hidden"
                name="listingId"
                value={!selectedConversation ? selectedListing?.id ?? "" : ""}
              />

              <textarea
                name="body"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                disabled={!canSend || pending}
                className="min-h-28 w-full resize-none bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={
                  selectedListingOwnedByCurrentUser
                    ? "Buyer messages for your listing will appear here."
                    : selectedConversation
                      ? "Write your reply..."
                      : `Write the first message about "${selectedListingTitle}"...`
                }
              />

              {state.fieldErrors?.body ? (
                <p className="mt-2 text-sm text-[#b93820]">{state.fieldErrors.body}</p>
              ) : null}

              {state.message ? (
                <p className="mt-2 rounded-2xl border border-[rgba(185,56,32,0.18)] bg-[rgba(255,243,240,0.95)] px-4 py-3 text-sm text-[#8f2e1c]">
                  {state.message}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {quickReplyLabels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      disabled={!canSend || pending}
                      onClick={() =>
                        setDraftMessage(buildQuickReply(label, selectedListingTitle))
                      }
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDraftMessage("")}
                    className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
                  >
                    Clear draft
                  </button>
                  <button
                    type="submit"
                    disabled={!canSend || pending || !draftMessage.trim()}
                    className="rounded-full bg-[linear-gradient(135deg,#6668E8,#4F57D8)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending
                      ? "Sending..."
                      : selectedConversation
                        ? "Send reply"
                        : "Start conversation"}
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">
            Select a conversation to continue chatting, or open a listing and use
            the chat action to start a new message thread.
          </div>
        )}
      </section>
    </div>
  );
}
