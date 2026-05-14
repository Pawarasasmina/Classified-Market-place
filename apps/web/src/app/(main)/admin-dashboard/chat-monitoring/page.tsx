import Link from "next/link";
import { requireAdminSession } from "@/lib/auth-dal";
import { fetchConversations } from "@/lib/marketplace-api";
import { AdminPageHeader, AdminPanel, EmptyState } from "@/components/marketplace/admin-ui";

export default async function AdminChatMonitoringPage() {
  const { accessToken, user } = await requireAdminSession("/admin/chat-monitoring");
  const conversations = await fetchConversations(accessToken, user.id, { take: 20 }).catch(() => []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Chat Monitoring"
        title="Review conversations for safety and moderation signals."
        description="Prioritize reported chats, scam keyword alerts, and suspicious patterns while preserving privacy constraints."
      />

      <AdminPanel title="Conversation list">
        {conversations.length ? (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)]">{conversation.listing.title}</p>
                  <p className="text-xs text-[var(--muted)]">{conversation.updatedLabel}</p>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{conversation.latestMessagePreview}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/messages?conversation=${conversation.id}`} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                    View chat (safety case)
                  </Link>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                    Flag scam keyword
                  </button>
                  <button className="rounded-full border border-[rgba(185,56,32,0.22)] bg-[rgba(255,243,240,0.95)] px-3 py-1 text-xs font-semibold text-[#8f2e1c]">
                    Block user
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No conversations available for monitoring." />
        )}
      </AdminPanel>
    </div>
  );
}
