import { InboxWorkspace } from "@/components/marketplace/inbox-workspace";

export default function MessagesPage() {
  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Chat MVP
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Buyer-to-seller conversations, unread counts, and real-time thread UI.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          Sprint 5 in the delivery plan introduces conversation lists, message
          storage, unread badges, and a listing-aware chat workflow. This
          workspace deploys that Phase 1 structure in the web app.
        </p>
      </div>

      <InboxWorkspace />
    </div>
  );
}
