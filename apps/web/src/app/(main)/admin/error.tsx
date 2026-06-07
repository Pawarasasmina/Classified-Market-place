"use client";

import Link from "next/link";

type AdminErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function isDatabaseUnavailable(error: Error) {
  return error.message
    .toLowerCase()
    .includes("database is temporarily unavailable");
}

export default function AdminErrorPage({ error, reset }: AdminErrorPageProps) {
  const databaseUnavailable = isDatabaseUnavailable(error);

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Admin workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {databaseUnavailable ? "Database unavailable" : "Admin page error"}
          </h1>
          <p className="mt-2 max-w-3xl text-[var(--muted)]">
            {databaseUnavailable
              ? error.message
              : "This admin page could not load. Retry the request, or return to the dashboard."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="action-primary px-4 py-2 text-sm font-semibold"
          >
            Retry
          </button>
          <Link
            href="/admin"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
