import { InboxWorkspace } from "@/components/marketplace/inbox-workspace";
import { requireClientSession } from "@/lib/auth-dal";
import {
  fetchConversation,
  fetchConversations,
  fetchListing,
} from "@/lib/marketplace-api";

type MessagesPageProps = {
  searchParams: Promise<{
    listing?: string;
    conversation?: string;
  }>;
};

export default async function MessagesPage(props: MessagesPageProps) {
  const { accessToken, user } = await requireClientSession("/messages");
  const searchParams = await props.searchParams;
  const listingId = searchParams.listing;
  const conversationId = searchParams.conversation;

  const conversations = await fetchConversations(accessToken, user.id, { take: 25 });
  const selectedConversationId = conversationId
    ? conversationId
    : listingId
      ? conversations.find((conversation) => conversation.listingId === listingId)?.id
      : conversations[0]?.id;

  const [selectedConversation, fallbackListing] = await Promise.all([
    selectedConversationId
      ? fetchConversation(accessToken, user.id, selectedConversationId)
      : Promise.resolve(null),
    !selectedConversationId && listingId ? fetchListing(listingId) : Promise.resolve(null),
  ]);
  const selectedListing = selectedConversation?.listing ?? fallbackListing;

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl rounded-[2.25rem] border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Chat workspace
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Live inbox, real conversations, and listing-aware outreach.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          This workspace now loads the signed-in user&apos;s actual conversations
          from the backend. You can continue an existing thread or start a new
          one directly from a listing context.
        </p>
      </div>

      <InboxWorkspace
        currentUserId={user.id}
        conversations={conversations}
        selectedConversation={selectedConversation}
        selectedListing={selectedListing}
      />
    </div>
  );
}
