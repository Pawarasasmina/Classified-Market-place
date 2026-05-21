import Link from "next/link";
import { redirect } from "next/navigation";
import { updateListingReportAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminListingReports } from "@/lib/marketplace-api";
import {
  type ApiListingStatus,
  type ApiReportStatus,
  humanizeReportStatus,
} from "@/lib/marketplace";

type AdminListingReportsPageProps = {
  searchParams: Promise<{
    listingId?: string;
    message?: string;
    reporterId?: string;
    status?: ApiReportStatus;
    updated?: string;
  }>;
};

const reportStatuses: ApiReportStatus[] = [
  "OPEN",
  "REVIEWED",
  "ACTIONED",
  "DISMISSED",
  "RESOLVED",
];

const listingStatuses: ApiListingStatus[] = [
  "ACTIVE",
  "REJECTED",
  "REMOVED",
  "DELETED",
  "SOLD",
];

function buildReturnTo(searchParams: Awaited<AdminListingReportsPageProps["searchParams"]>) {
  const params = new URLSearchParams();

  if (searchParams.status) params.set("status", searchParams.status);
  if (searchParams.listingId) params.set("listingId", searchParams.listingId);
  if (searchParams.reporterId) params.set("reporterId", searchParams.reporterId);

  const query = params.toString();
  return query ? `/admin/listing-reports?${query}` : "/admin/listing-reports";
}

function humanizeLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AdminListingReportsPage(
  props: AdminListingReportsPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/listing-reports",
  );

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const status = reportStatuses.includes(searchParams.status as ApiReportStatus)
    ? searchParams.status
    : undefined;
  const listingId = searchParams.listingId?.trim() || undefined;
  const reporterId = searchParams.reporterId?.trim() || undefined;
  const reports = await fetchAdminListingReports(accessToken, {
    status,
    listingId,
    reporterId,
    take: 100,
  });
  const returnTo = buildReturnTo(searchParams);
  const updateMessage =
    searchParams.updated === "success"
      ? "Report workflow updated."
      : searchParams.updated === "error"
        ? (searchParams.message ?? "Could not update that report.")
        : null;

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Trust and safety
          </p>
          <h1 className="mt-1 text-2xl font-bold">Listing reports</h1>
          <p className="mt-2 text-[var(--muted)]">
            Review buyer reports, leave internal notes, and action listings
            when needed.
          </p>
        </div>
        <Link
          href="/admin"
          className="action-secondary px-4 py-2 text-sm font-semibold"
        >
          Back to dashboard
        </Link>
      </div>

      {updateMessage ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm font-semibold ${
            searchParams.updated === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {updateMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Reports", reports.length],
          ["Open", reports.filter((report) => report.status === "OPEN").length],
          [
            "Actioned",
            reports.filter((report) => report.status === "ACTIONED").length,
          ],
          [
            "Dismissed",
            reports.filter((report) => report.status === "DISMISSED").length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <form className="panel grid gap-3 lg:grid-cols-[1fr_1.3fr_1.3fr_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="surface-input"
          >
            <option value="">All reports</option>
            {reportStatuses.map((item) => (
              <option key={item} value={item}>
                {humanizeReportStatus(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Listing ID
          <input
            name="listingId"
            defaultValue={listingId ?? ""}
            className="surface-input"
            placeholder="UUID"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Reporter ID
          <input
            name="reporterId"
            defaultValue={reporterId ?? ""}
            className="surface-input"
            placeholder="UUID"
          />
        </label>
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <section className="grid gap-4">
        {reports.length ? (
          reports.map((report) => (
            <article key={report.id} className="panel grid gap-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">
                      {report.listingTitle ?? report.listingId}
                    </h2>
                    <span className="admin-status-badge">
                      {report.statusLabel}
                    </span>
                    {report.listingStatus ? (
                      <span className="admin-status-badge">
                        Listing {report.listingStatus}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {report.reason} / Submitted {report.createdLabel} by{" "}
                    {report.reporterDisplayName ?? report.reporterId}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {report.reporterEmail ?? report.reporterId}
                  </p>
                </div>
                <Link
                  href={`/listings/${report.listingId}?view=customer`}
                  target="_blank"
                  rel="noreferrer"
                  className="action-secondary h-fit px-3 py-2 text-center text-sm font-black"
                >
                  Open listing
                </Link>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-sm">
                  <p className="font-black">Reporter details</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {report.details ?? "No extra detail provided."}
                  </p>
                </div>
                <div className="rounded-md border border-[var(--line)] bg-white p-3 text-sm">
                  <p className="font-black">Admin notes</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {report.adminNotes ?? "No internal note yet."}
                  </p>
                </div>
              </div>

              <form
                action={updateListingReportAction}
                className="grid gap-3 border-t border-[var(--line)] pt-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
              >
                <input type="hidden" name="reportId" value={report.id} />
                <input type="hidden" name="listingId" value={report.listingId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label className="grid gap-2 text-sm font-bold">
                  Report status
                  <select
                    name="status"
                    defaultValue={report.status}
                    className="surface-input"
                  >
                    {reportStatuses.map((item) => (
                      <option key={item} value={item}>
                        {humanizeReportStatus(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Listing action
                  <select name="listingStatus" className="surface-input">
                    <option value="">No listing change</option>
                    {listingStatuses.map((item) => (
                      <option key={item} value={item}>
                        {humanizeLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Admin notes
                  <textarea
                    name="adminNotes"
                    rows={3}
                    defaultValue={report.adminNotes ?? ""}
                    className="surface-input"
                    placeholder="Internal moderation notes"
                  />
                </label>
                <button className="action-primary px-4 py-3 text-sm font-black">
                  Save review
                </button>
              </form>
            </article>
          ))
        ) : (
          <div className="panel py-12 text-center">
            <h2 className="text-xl font-black">No listing reports found</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Submitted listing reports will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
