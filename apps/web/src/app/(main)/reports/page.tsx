import Link from "next/link";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchMyListingReports } from "@/lib/marketplace-api";
import {
  type ApiReportStatus,
  humanizeReportStatus,
} from "@/lib/marketplace";

type ReportsPageProps = {
  searchParams: Promise<{
    status?: ApiReportStatus;
  }>;
};

const reportStatuses: ApiReportStatus[] = [
  "OPEN",
  "REVIEWED",
  "ACTIONED",
  "DISMISSED",
  "RESOLVED",
];

export default async function ReportsPage(props: ReportsPageProps) {
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/reports");
  const status = reportStatuses.includes(searchParams.status as ApiReportStatus)
    ? searchParams.status
    : undefined;
  const reports = await fetchMyListingReports(accessToken, {
    status,
    take: 100,
  });

  return (
    <div className="page grid gap-6">
      <div className="panel-dark flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="section-eyebrow">Trust and safety</p>
          <h1 className="mt-2 text-3xl font-black text-white">My Reports</h1>
          <p className="mt-2 max-w-3xl text-[#d7d9ea]">
            Track listing reports you submitted to the marketplace moderation
            team.
          </p>
        </div>
        <Link
          href="/search"
          className="rounded-md bg-white px-4 py-3 text-sm font-bold text-[var(--foreground)]"
        >
          Browse listings
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Reports", reports.length],
          ["Open", reports.filter((report) => report.status === "OPEN").length],
          [
            "Reviewed",
            reports.filter((report) => report.status !== "OPEN").length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <form className="panel grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
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
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <section className="grid gap-3">
        {reports.length ? (
          reports.map((report) => (
            <article key={report.id} className="panel grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">
                      {report.listingTitle ?? "Listing report"}
                    </h2>
                    <span className="admin-status-badge">
                      {report.statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Submitted {report.createdLabel} / {report.reason}
                  </p>
                </div>
                <Link
                  href={`/listings/${report.listingId}`}
                  className="action-secondary px-3 py-2 text-sm font-black"
                >
                  View listing
                </Link>
              </div>
              {report.details ? (
                <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--muted)]">
                  {report.details}
                </p>
              ) : null}
              {report.adminNotes ? (
                <div className="rounded-md border border-[var(--line)] bg-white p-3 text-sm">
                  <p className="font-black">Admin notes</p>
                  <p className="mt-1 text-[var(--muted)]">{report.adminNotes}</p>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="panel py-12 text-center">
            <h2 className="text-xl font-black">No listing reports yet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Reports you submit from listing detail pages will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
