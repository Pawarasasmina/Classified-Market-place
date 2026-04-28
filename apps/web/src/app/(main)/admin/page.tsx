import { getListingById, moderationQueue } from "@/lib/phase1-data";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Admin moderation MVP
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Listing review queue, basic actions, and release hardening placeholders.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          Sprint 6 calls for a moderation queue, approve or reject actions, user
          search, and safety hardening before the MVP release gate. This admin
          route makes those web operations visible in the prototype.
        </p>
      </div>

      <div className="grid gap-4">
        {moderationQueue.map((item) => {
          const listing = getListingById(item.listingId);

          return (
            <section
              key={item.id}
              className="grid gap-5 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6 xl:grid-cols-[0.56fr_0.22fr_0.22fr]"
            >
              <div>
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  {item.reason}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {listing?.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  Submitted by {item.reportedBy} • {item.submittedAt}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Current status
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {item.status}
                </p>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  className="rounded-full bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-[var(--surface)]"
                >
                  Approve listing
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                >
                  Reject / remove
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
