import { moderateListingAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchModerationQueue } from "@/lib/marketplace-api";

function canModerate(role: string) {
  const normalizedRole = role.trim().toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "moderator";
}

export default async function AdminPage() {
  const { accessToken, user } = await requireSessionContext("/admin");
  const allowed = canModerate(user.role);
  const reviewQueue = allowed
    ? await fetchModerationQueue(accessToken, {
        take: 12,
      })
    : [];

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Admin moderation
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Real moderation queue, audit history, and listing actions.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          Reports now persist through the backend and feed a live moderation queue.
          Signed-in role: {user.role}.
        </p>
      </div>

      {!allowed ? (
        <div className="rounded-[2rem] border border-[rgba(185,56,32,0.18)] bg-[rgba(255,243,240,0.95)] px-6 py-5 text-sm leading-7 text-[#8f2e1c]">
          This area is restricted to admin and moderator accounts. Sign in with a
          moderation-capable user to review reports and approve, reject, or remove
          listings.
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-5 text-sm text-[var(--muted)]">
            Draft listings and listings with open reports now appear in this queue.
            Actions are saved through the backend moderation workflow and written to
            audit history.
          </div>

          <div className="grid gap-4">
            {reviewQueue.length ? (
              reviewQueue.map((item) => {
                const latestReport = item.latestReport;
                const latestEvent = item.latestModerationEvent;

                return (
                  <section
                    key={item.listing.id}
                    className="grid gap-5 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6 xl:grid-cols-[0.5fr_0.22fr_0.28fr]"
                  >
                    <div>
                      <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                        {item.listing.categorySlug || "uncategorized"}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                        {item.listing.title}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                        {item.listing.location} - {item.listing.postedLabel} -{" "}
                        {item.listing.priceLabel}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                          {item.openReportCount} open report
                          {item.openReportCount === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                          {item.reportCount} total report
                          {item.reportCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      {latestReport ? (
                        <div className="mt-5 rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                            Latest report
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                            {latestReport.reason}
                          </p>
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            Reported by {latestReport.reporterName} - {latestReport.reportedAtLabel}
                          </p>
                          {latestReport.details ? (
                            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                              {latestReport.details}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          Current status
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                          {item.listing.status}
                        </p>
                      </div>

                      <div className="rounded-[1.5rem] border border-[var(--line)] bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          Latest audit
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {latestEvent?.actionLabel ?? "No moderation action yet"}
                        </p>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {latestEvent
                            ? `${latestEvent.actorName} - ${latestEvent.createdAtLabel}`
                            : "Waiting for first review action"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <form
                        action={moderateListingAction.bind(
                          null,
                          item.listing.id,
                          "LISTING_APPROVED",
                          latestReport?.id ?? null,
                          "/admin"
                        )}
                      >
                        <button
                          type="submit"
                          className="w-full rounded-full bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-[var(--surface)]"
                        >
                          Approve listing
                        </button>
                      </form>

                      <form
                        action={moderateListingAction.bind(
                          null,
                          item.listing.id,
                          "LISTING_REJECTED",
                          latestReport?.id ?? null,
                          "/admin"
                        )}
                      >
                        <button
                          type="submit"
                          className="w-full rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                        >
                          Reject to draft
                        </button>
                      </form>

                      <form
                        action={moderateListingAction.bind(
                          null,
                          item.listing.id,
                          "LISTING_REMOVED",
                          latestReport?.id ?? null,
                          "/admin"
                        )}
                      >
                        <button
                          type="submit"
                          className="w-full rounded-full border border-[rgba(185,56,32,0.22)] bg-[rgba(255,243,240,0.95)] px-4 py-3 text-sm font-semibold text-[#8f2e1c]"
                        >
                          Remove listing
                        </button>
                      </form>
                    </div>
                  </section>
                );
              })
            ) : (
              <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.7)] px-6 py-10 text-sm text-[var(--muted)]">
                No listings are currently waiting for moderation.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
