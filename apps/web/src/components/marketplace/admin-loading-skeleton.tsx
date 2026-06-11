type AdminLoadingVariant = "dashboard" | "detail" | "report" | "table";

type AdminLoadingSkeletonProps = {
  variant?: AdminLoadingVariant;
};

const tableRows = Array.from({ length: 7 }, (_, index) => index);
const statCards = Array.from({ length: 4 }, (_, index) => index);
const actionCards = Array.from({ length: 5 }, (_, index) => index);

export function AdminLoadingSkeleton({
  variant = "table",
}: AdminLoadingSkeletonProps) {
  return (
    <div
      className="page admin-loading-page"
      aria-busy="true"
      aria-label="Loading admin content"
    >
      <section className="panel admin-loading-hero">
        <div className="grid min-w-0 gap-3">
          <div className="admin-loading-line admin-loading-kicker" />
          <div className="admin-loading-line admin-loading-title" />
          <div className="admin-loading-line admin-loading-copy" />
        </div>
        <div className="admin-loading-pill" />
      </section>

      {variant === "dashboard" ? <DashboardLoading /> : null}
      {variant === "report" ? <ReportLoading /> : null}
      {variant === "detail" ? <DetailLoading /> : null}
      {variant === "table" ? <TableLoading /> : null}
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="admin-dashboard grid gap-4">
      <div className="admin-card-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <SkeletonStatCard key={item} />
        ))}
      </div>

      <div className="admin-card-grid grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {actionCards.map((item) => (
          <SkeletonActionCard key={item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
    </div>
  );
}

function ReportLoading() {
  return (
    <div className="grid gap-4">
      <div className="panel admin-loading-filter-bar">
        <div className="admin-loading-pill" />
        <div className="admin-loading-pill" />
        <div className="admin-loading-pill" />
        <div className="admin-loading-pill" />
      </div>

      <div className="admin-card-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <SkeletonStatCard key={item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
        <SkeletonPanel />
        <SkeletonTable />
      </div>
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
      <div className="grid gap-4">
        <SkeletonPanel />
        <SkeletonPanel compact />
      </div>
      <div className="grid gap-4">
        <div className="admin-card-grid grid gap-4 sm:grid-cols-2">
          {statCards.slice(0, 2).map((item) => (
            <SkeletonStatCard key={item} />
          ))}
        </div>
        <SkeletonTable />
      </div>
    </div>
  );
}

function TableLoading() {
  return (
    <div className="grid gap-4">
      <div className="admin-card-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <SkeletonStatCard key={item} />
        ))}
      </div>
      <div className="panel admin-loading-filter-bar">
        <div className="admin-loading-input" />
        <div className="admin-loading-input" />
        <div className="admin-loading-pill" />
      </div>
      <SkeletonTable />
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div className="admin-stat-card admin-loading-card">
      <div className="admin-loading-line admin-loading-label" />
      <div className="admin-loading-line admin-loading-number" />
      <div className="admin-loading-line admin-loading-small" />
    </div>
  );
}

function SkeletonActionCard() {
  return (
    <div className="admin-dashboard-card admin-action-card">
      <div className="admin-card-body">
        <div className="admin-card-head">
          <div className="admin-loading-icon" />
          <div className="grid gap-2">
            <div className="admin-loading-line admin-loading-label" />
            <div className="admin-loading-line admin-loading-card-title" />
            <div className="admin-loading-line admin-loading-copy" />
          </div>
        </div>
        <div className="admin-loading-pill admin-loading-card-pill" />
      </div>
    </div>
  );
}

function SkeletonPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className="panel admin-loading-panel">
      <div className="admin-loading-line admin-loading-title" />
      <div className="admin-loading-line admin-loading-copy" />
      <div className="grid gap-2">
        <div className="admin-loading-line admin-loading-row-line" />
        <div className="admin-loading-line admin-loading-row-line" />
        {!compact ? (
          <div className="admin-loading-line admin-loading-row-line" />
        ) : null}
      </div>
    </section>
  );
}

function SkeletonTable() {
  return (
    <div className="admin-table-wrap admin-loading-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>
              <div className="admin-loading-line admin-loading-th" />
            </th>
            <th>
              <div className="admin-loading-line admin-loading-th" />
            </th>
            <th>
              <div className="admin-loading-line admin-loading-th" />
            </th>
            <th>
              <div className="admin-loading-line admin-loading-th" />
            </th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => (
            <tr key={row}>
              <td>
                <div className="admin-loading-line admin-loading-cell-wide" />
              </td>
              <td>
                <div className="admin-loading-line admin-loading-cell" />
              </td>
              <td>
                <div className="admin-loading-pill admin-loading-status" />
              </td>
              <td>
                <div className="admin-loading-pill admin-loading-action" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
