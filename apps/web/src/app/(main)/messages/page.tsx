import { InboxWorkspace } from "@/components/marketplace/inbox-workspace";
import { requireVerifiedSession } from "@/lib/auth-dal";
import { getMessagingApiBaseUrl } from "@/lib/messaging-api";

type MessagesPageProps = {
  searchParams: Promise<{
    conversation?: string;
    listing?: string;
    user?: string;
  }>;
};

export default async function MessagesPage(props: MessagesPageProps) {
  const searchParams = await props.searchParams;
  const nextParams = new URLSearchParams();

  if (searchParams.conversation) {
    nextParams.set("conversation", searchParams.conversation);
  }

  if (searchParams.listing) {
    nextParams.set("listing", searchParams.listing);
  }

  if (searchParams.user) {
    nextParams.set("user", searchParams.user);
  }

  const nextPath = nextParams.size
    ? `/messages?${nextParams.toString()}`
    : "/messages";
  const { accessToken, user } = await requireVerifiedSession(nextPath);

  return (
    <div className="page grid gap-4">
      <InboxWorkspace
        key={user.id}
        accessToken={accessToken}
        apiBaseUrl={getMessagingApiBaseUrl()}
        currentUserId={user.id}
        currentUserRole={user.role}
        selectedConversationId={searchParams.conversation}
        selectedListingId={searchParams.listing}
        selectedParticipantId={searchParams.user}
      />
    </div>
  );
}
