import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminAuditLogs } from "@/lib/marketplace-api";

type AdminAuditLogsPageProps = {
  searchParams: Promise<{
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    success?: string;
    from?: string;
    to?: string;
  }>;
};

function normalizeTextFilter(value: string | undefined) {
  return value?.trim() || undefined;
}

function normalizeSuccessFilter(value: string | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJson(value: unknown) {
  if (value == null) {
    return "None";
  }

  return JSON.stringify(value, null, 2);
}

export default async function AdminAuditLogsPage(
  props: AdminAuditLogsPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/audit-logs",
  );

  if (!hasAdminPermission(user.role, "AUDIT_LOGS_READ")) {
    redirect("/");
  }

  const actorId = normalizeTextFilter(searchParams.actorId);
  const action = normalizeTextFilter(searchParams.action)?.toUpperCase();
  const entityType = normalizeTextFilter(searchParams.entityType);
  const entityId = normalizeTextFilter(searchParams.entityId);
  const success = normalizeSuccessFilter(searchParams.success);
  const from = normalizeTextFilter(searchParams.from);
  const to = normalizeTextFilter(searchParams.to);
  const auditLogs = await fetchAdminAuditLogs(accessToken, {
    actorId,
    action,
    entityType,
    entityId,
    success,
    from,
    to,
    take: 100,
  });
  const failedCount = auditLogs.filter((log) => !log.success).length;
  const adminActionCount = auditLogs.filter(
    (log) => log.actorRole?.toUpperCase() === "ADMIN",
  ).length;

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Security
          </p>
          <h1 className="mt-1 text-2xl font-bold">Audit logs</h1>
          <p className="mt-2 text-[var(--muted)]">
            Review state-changing requests, admin actions, auth events, and
            failed writes.
          </p>
        </div>
        <Link
          href="/admin"
          className="action-secondary px-4 py-2 text-sm font-semibold"
        >
          Back to dashboard
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Events", auditLogs.length],
          ["Failed", failedCount],
          ["Admin actor", adminActionCount],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <form className="panel grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Outcome
          <select
            name="success"
            defaultValue={
              success === undefined ? "" : success ? "true" : "false"
            }
            className="surface-input"
          >
            <option value="">All</option>
            <option value="true">Succeeded</option>
            <option value="false">Failed</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Action
          <input
            name="action"
            defaultValue={action ?? ""}
            className="surface-input"
            placeholder="UPDATE_USER"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Actor ID
          <input
            name="actorId"
            defaultValue={actorId ?? ""}
            className="surface-input"
            placeholder="UUID"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Entity
          <input
            name="entityType"
            defaultValue={entityType ?? ""}
            className="surface-input"
            placeholder="listing"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Entity ID
          <input
            name="entityId"
            defaultValue={entityId ?? ""}
            className="surface-input"
            placeholder="UUID"
          />
        </label>
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Request</th>
              <th>Outcome</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td>
                  <span className="font-semibold">{log.actionLabel}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.id}
                  </span>
                </td>
                <td>
                  <span className="font-semibold">
                    {log.actorDisplayName ?? "System"}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.actorEmail ?? log.actorId ?? "No actor"}
                  </span>
                </td>
                <td>
                  <span className="font-semibold">
                    {log.entityType ?? "resource"}
                  </span>
                  <span className="block max-w-[18rem] break-all text-xs text-[var(--muted)]">
                    {log.entityId ?? "No entity id"}
                  </span>
                </td>
                <td>
                  <code className="text-xs font-semibold">
                    {log.method} {log.path}
                  </code>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.ipAddress ?? "No IP"} /{" "}
                    {log.durationMs == null ? "No timing" : `${log.durationMs}ms`}
                  </span>
                </td>
                <td>
                  <span className="admin-status-badge">
                    {log.outcomeLabel}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.statusCode ?? "No status"}
                  </span>
                </td>
                <td>{formatDateTime(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {auditLogs.length === 0 ? (
          <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
            No audit logs match those filters.
          </div>
        ) : null}
      </div>

      <section className="grid gap-3">
        {auditLogs.slice(0, 20).map((log) => (
          <details key={log.id} className="panel">
            <summary className="cursor-pointer font-semibold">
              {log.actionLabel} / {formatDateTime(log.createdAt)}
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold">Request</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--surface-strong)] p-3 text-xs">
                  {formatJson({
                    params: log.requestParams,
                    query: log.requestQuery,
                    body: log.requestBody,
                  })}
                </pre>
              </div>
              <div>
                <p className="text-sm font-semibold">Result</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--surface-strong)] p-3 text-xs">
                  {formatJson({
                    statusCode: log.statusCode,
                    success: log.success,
                    response: log.responseSummary,
                    error: log.errorMessage,
                    userAgent: log.userAgent,
                  })}
                </pre>
              </div>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
