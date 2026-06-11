import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { AdminTablePagination } from "@/components/marketplace/admin-table-pagination";
import { hasAdminPermission } from "@/lib/admin-permissions";
import {
  buildAdminPaginationHref,
  getAdminPaginationHiddenFields,
  getAdminPaginationState,
  paginateAdminItems,
} from "@/lib/admin-pagination";
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
    page?: string;
    pageSize?: string;
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
  const pagination = getAdminPaginationState(searchParams, auditLogs.length);
  const paginatedAuditLogs = paginateAdminItems(auditLogs, pagination);
  const paginationParams = {
    actorId,
    action,
    entityType,
    entityId,
    success: searchParams.success,
    from,
    to,
    pageSize: pagination.pageSize,
  };
  const failedCount = auditLogs.filter((log) => !log.success).length;
  const adminActionCount = auditLogs.filter(
    (log) => log.actorRole?.toUpperCase() === "ADMIN",
  ).length;

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Security"
        title="Audit logs"
        description="Review state-changing requests, admin actions, auth events, and failed writes."
        badge={`${auditLogs.length} events`}
        actions={
          <Link
            href="/admin"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Back to dashboard
          </Link>
        }
      />

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

      <form className="panel admin-filter-bar grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
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

      <AdminTableEnhancer tableId="admin-audit-logs-table" copyLabel="log IDs" />
      <div className="admin-table-wrap">
        <table id="admin-audit-logs-table" className="admin-table">
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
            {paginatedAuditLogs.map((log) => (
              <tr key={log.id} data-row-id={log.id}>
                <td data-label="Event">
                  <span className="font-semibold">{log.actionLabel}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.id}
                  </span>
                </td>
                <td data-label="Actor">
                  <span className="font-semibold">
                    {log.actorDisplayName ?? "System"}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.actorEmail ?? log.actorId ?? "No actor"}
                  </span>
                </td>
                <td data-label="Target">
                  <span className="font-semibold">
                    {log.entityType ?? "resource"}
                  </span>
                  <span className="block max-w-[18rem] break-all text-xs text-[var(--muted)]">
                    {log.entityId ?? "No entity id"}
                  </span>
                </td>
                <td data-label="Request">
                  <code className="text-xs font-semibold">
                    {log.method} {log.path}
                  </code>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.ipAddress ?? "No IP"} /{" "}
                    {log.durationMs == null ? "No timing" : `${log.durationMs}ms`}
                  </span>
                </td>
                <td data-label="Outcome">
                  <span
                    className="admin-status-badge"
                    data-status={log.success ? "succeeded" : "failed"}
                  >
                    {log.outcomeLabel}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {log.statusCode ?? "No status"}
                  </span>
                </td>
                <td data-label="When">{formatDateTime(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {auditLogs.length === 0 ? (
          <div className="admin-empty-state">
            <p className="admin-empty-state-title">No audit logs found</p>
            <p className="admin-empty-state-copy">
              Try clearing one of the actor, action, entity, or outcome filters.
            </p>
          </div>
        ) : null}
      </div>
      {auditLogs.length > 0 ? (
        <AdminTablePagination
          buildPageHref={(page, pageSize = pagination.pageSize) =>
            buildAdminPaginationHref("/admin/audit-logs", paginationParams, {
              page,
              pageSize,
            })
          }
          hiddenFields={getAdminPaginationHiddenFields(paginationParams)}
          itemLabel="events"
          pagination={pagination}
        />
      ) : null}

      <section className="grid gap-3">
        {paginatedAuditLogs.map((log) => (
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
