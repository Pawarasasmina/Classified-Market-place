import { InboxWorkspace } from "@/components/marketplace/inbox-workspace";
import { requireSessionContext } from "@/lib/auth-dal";
import { getMessagingApiBaseUrl } from "@/lib/messaging-api";

type MessagesPageProps = {
  searchParams: Promise<{
    listing?: string;
    user?: string;
  }>;
};

export default async function MessagesPage(props: MessagesPageProps) {
  const { accessToken, user } = await requireSessionContext("/messages");
  const searchParams = await props.searchParams;
  const listingId = searchParams.listing;
  const participantId = searchParams.user;

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          In-app chat
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Real-time conversations for buyers and sellers.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          Messages now use the backend conversation API, Socket.IO live updates,
          unread counts, typing indicators, presence, listing cards, images, and offers.
        </p>
      </div>

      <InboxWorkspace
        accessToken={accessToken}
        apiBaseUrl={getMessagingApiBaseUrl()}
        currentUserId={user.id}
        currentUserRole={user.role}
        selectedListingId={listingId}
        selectedParticipantId={participantId}
      />
    </div>
  );
}
