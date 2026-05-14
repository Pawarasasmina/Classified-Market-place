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

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6 sm:p-8">
        <p className="section-eyebrow">Messages</p>
        <h1 className="mt-3 text-3xl font-black text-white">
          Keep every buyer and seller conversation in one calm workspace.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d7d9ea] sm:text-base">
          Continue listing enquiries, seller questions, and support threads
          without leaving the marketplace.
        </p>
      </div>

      <InboxWorkspace
        accessToken={accessToken}
        apiBaseUrl={getMessagingApiBaseUrl()}
        currentUserId={user.id}
        currentUserRole={user.role}
        selectedListingId={searchParams.listing}
        selectedParticipantId={searchParams.user}
      />
    </div>
  );
}
