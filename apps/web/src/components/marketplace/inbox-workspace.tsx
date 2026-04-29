"use client";

import { useState } from "react";
import Link from "next/link";
import { type MarketplaceListing, type MarketplaceSeller } from "@/lib/marketplace";

type InboxWorkspaceProps = {
  selectedListing?: MarketplaceListing | null;
  seller?: MarketplaceSeller | null;
  recentListings: MarketplaceListing[];
  conversationSeed?: {
    buyerMessages: string[];
    sellerReply?: string;
  };
};

export function InboxWorkspace({
  selectedListing,
  seller,
  recentListings,
  conversationSeed,
}: InboxWorkspaceProps) {
  const [draftMessage, setDraftMessage] = useState("");

  const sampleMessages = selectedListing
    ? [
        {
          id: "buyer-1",
          mine: true,
          body:
            conversationSeed?.buyerMessages[0] ??
            `Hi, is "${selectedListing.title}" still available?`,
          sentAt: "Draft",
        },
        ...(conversationSeed?.sellerReply
          ? [
              {
                id: "seller-1",
                mine: false,
                body: conversationSeed.sellerReply,
                sentAt: "Pending API",
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.32fr_0.68fr]">
      <aside className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.85)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Inbox
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              Listing contexts
            </h2>
          </div>
          <span className="rounded-full bg-[rgba(31,107,90,0.1)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            {recentListings.length} live
          </span>
        </div>

        <div className="space-y-3">
          {recentListings.length ? (
            recentListings.map((listing) => {
              const active = listing.id === selectedListing?.id;

              return (
                <Link
                  key={listing.id}
                  href={`/messages?listing=${listing.id}`}
                  className={`block rounded-[1.5rem] border p-4 text-left ${
                    active
                      ? "border-transparent bg-[var(--foreground)] text-[var(--surface)]"
                      : "border-[var(--line)] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{listing.subcategory}</p>
                    <span className="text-xs opacity-70">{listing.postedLabel}</span>
                  </div>
                  <p className="mt-2 text-sm opacity-80">{listing.title}</p>
                  <p className="mt-2 text-sm opacity-70">{listing.priceLabel}</p>
                </Link>
              );
            })
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
              No live listings are available to anchor a conversation yet.
            </div>
          )}
        </div>
      </aside>

      <section className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.85)] p-6">
        {selectedListing ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div>
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  Live listing context
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {selectedListing.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {seller
                    ? `Seller: ${seller.name} - ${seller.verified ? "verified" : "unverified"}`
                    : "Seller profile unavailable"}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
                Messaging API is not available yet. This view now uses the real
                listing and seller context instead of mock conversations.
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {sampleMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[32rem] rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${
                      message.mine
                        ? "bg-[var(--foreground)] text-[var(--surface)]"
                        : "bg-[rgba(31,107,90,0.08)] text-[var(--foreground)]"
                    }`}
                  >
                    <p>{message.body}</p>
                    <p className="mt-2 text-xs opacity-70">{message.sentAt}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-[var(--line)] bg-white p-4">
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                className="min-h-28 w-full resize-none bg-transparent text-sm outline-none"
                placeholder="Type the message you plan to send once conversation persistence is connected..."
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
                  Clear draft
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">
            Select a listing to prepare a conversation. The real-time chat API is
            still pending on the backend.
          </div>
        )}
      </section>
    </div>
  );
}
