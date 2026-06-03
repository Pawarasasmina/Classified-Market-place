import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminReportEmailForm } from "@/components/marketplace/admin-report-email-form";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchWalletPaymentsReport } from "@/lib/marketplace-api";
import {
  humanizeTransactionStatus,
  type ApiTransactionStatus,
} from "@/lib/marketplace";

type WalletPaymentsReportPageProps = {
  searchParams: Promise<{
    days?: string;
    email?: string;
    message?: string;
  }>;
};

const dayOptions = [7, 30, 90, 180] as const;
const paymentStatuses: ApiTransactionStatus[] = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

function humanizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(value: number) {
  return value.toLocaleString("en");
}

function formatMoney(value: number, currency = "AED") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedMoney(value: number, currency = "AED") {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";

  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function barWidth(value: number, max: number) {
  if (!max) {
    return "0%";
  }

  return `${Math.max(4, Math.min(100, (value / max) * 100))}%`;
}

export default async function WalletPaymentsReportPage(
  props: WalletPaymentsReportPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/reports/wallet-payments",
  );

  if (!hasAdminPermission(user.role, "REPORTS_READ")) {
    redirect("/");
  }

  const canEmailReports = hasAdminPermission(user.role, "REPORTS_EMAIL");
  const requestedDays = Number(searchParams.days);
  const selectedDays = dayOptions.some((days) => days === requestedDays)
    ? requestedDays
    : 30;
  const returnTo = `/admin/reports/wallet-payments?days=${selectedDays}`;
  const report = await fetchWalletPaymentsReport(accessToken, {
    days: selectedDays,
    take: 100,
  });
  const maxTopUpStatus = Math.max(
    1,
    ...paymentStatuses.map((status) => report.topUps.statuses[status] ?? 0),
  );
  const maxWalletPaymentStatus = Math.max(
    1,
    ...paymentStatuses.map(
      (status) => report.walletPayments.statuses[status] ?? 0,
    ),
  );
  const maxMovement = Math.max(
    1,
    ...report.movement.byType.map((item) => Math.abs(item.amount)),
  );

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Payments report
          </p>
          <h1 className="mt-1 text-2xl font-bold">Wallet payments</h1>
          <p className="mt-2 text-[var(--muted)]">
            {formatDate(report.range.from)} to {formatDate(report.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEmailReports ? (
            <AdminReportEmailForm
              filters={{ days: selectedDays, take: 100 }}
              message={searchParams.message}
              reportType="wallet-payments"
              returnTo={returnTo}
              status={searchParams.email}
            />
          ) : null}
          {dayOptions.map((days) => (
            <Link
              key={days}
              href={`/admin/reports/wallet-payments?days=${days}`}
              className={`px-4 py-2 text-sm font-semibold ${
                selectedDays === days ? "action-primary" : "action-secondary"
              }`}
            >
              {days} days
            </Link>
          ))}
          <Link
            href="/admin/transactions?type=WALLET_TOP_UP"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Wallet ledger
          </Link>
          <Link
            href="/admin/reports"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Operations report
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Wallets", report.overview.totalWallets, "accounts created"],
          ["Funded", report.overview.fundedWallets, "positive balance"],
          ["Total balance", formatMoney(report.overview.totalBalance), "held"],
          [
            "Credits",
            formatMoney(report.movement.creditAmount),
            "wallet inflow",
          ],
          ["Debits", formatMoney(report.movement.debitAmount), "wallet spend"],
          [
            "Net movement",
            formatSignedMoney(report.movement.netMovement),
            "selected window",
          ],
          [
            "Top-ups",
            report.topUps.requested,
            `${report.topUps.conversionRate}% success`,
          ],
          ["Top-up revenue", formatMoney(report.topUps.revenue), "settled"],
          [
            "Wallet spend",
            formatMoney(report.walletPayments.spend),
            "successful payments",
          ],
          [
            "Avg balance",
            formatMoney(report.overview.averageBalance),
            "per wallet",
          ],
        ].map(([label, value, detail]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">
              {typeof value === "number" ? formatMetric(value) : value}
            </p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              {detail}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Top-up Status</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Seller wallet top-up transaction outcomes.
            </p>
          </div>
          <div className="grid gap-3">
            {paymentStatuses.map((status) => {
              const value = report.topUps.statuses[status] ?? 0;

              return (
                <div key={status} className="grid gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{humanizeTransactionStatus(status)}</span>
                    <span className="font-bold">{formatMetric(value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                    <div
                      className="h-2 rounded-full bg-[var(--success)]"
                      style={{ width: barWidth(value, maxTopUpStatus) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Wallet Payment Status</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Purchases paid from wallet balance.
            </p>
          </div>
          <div className="grid gap-3">
            {paymentStatuses.map((status) => {
              const value = report.walletPayments.statuses[status] ?? 0;

              return (
                <div key={status} className="grid gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{humanizeTransactionStatus(status)}</span>
                    <span className="font-bold">{formatMetric(value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                    <div
                      className="h-2 rounded-full bg-[var(--brand)]"
                      style={{
                        width: barWidth(value, maxWalletPaymentStatus),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel grid gap-4">
          <div>
            <h2 className="text-xl font-semibold">Balance Movement</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ledger entries grouped by movement type.
            </p>
          </div>
          <div className="grid gap-3">
            {report.movement.byType.map((item) => (
              <div key={item.type} className="grid gap-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{humanizeLabel(item.type)}</span>
                  <span className="font-bold">
                    {formatSignedMoney(item.amount)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(8,13,29,0.64)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent-strong)]"
                    style={{
                      width: barWidth(Math.abs(item.amount), maxMovement),
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {formatMetric(item.count)} ledger entries
                </p>
              </div>
            ))}
            {report.movement.byType.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Wallet ledger movement will appear here.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Wallet Accounts</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ranked by current balance, with recent wallet activity.
            </p>
          </div>
          <Link
            href="/admin/transactions"
            className="action-secondary px-3 py-2 text-sm font-semibold"
          >
            Open transactions
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Balance</th>
                <th>Movement</th>
                <th>Latest Activity</th>
                <th>Recent Ledger</th>
              </tr>
            </thead>
            <tbody>
              {report.wallets.map((wallet) => (
                <tr key={wallet.id}>
                  <td>
                    <Link
                      href={`/sellers/${wallet.userId}?view=customer`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      {wallet.user.displayName}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {wallet.user.email}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {humanizeLabel(wallet.user.sellerPriorityTier ?? "NONE")}{" "}
                      / Reputation {formatMetric(wallet.user.reputationScore)}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatMoney(wallet.balance, wallet.currency)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      Updated {formatDate(wallet.updatedAt)}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {formatSignedMoney(wallet.netMovement, wallet.currency)}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      In {formatMoney(wallet.creditTotal, wallet.currency)} /
                      Out {formatMoney(wallet.debitTotal, wallet.currency)}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold">
                      {wallet.latestLedgerType
                        ? humanizeLabel(wallet.latestLedgerType)
                        : "No activity"}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {formatDate(wallet.latestLedgerAt)} /{" "}
                      {formatMetric(wallet.ledgerEntryCount)} entries
                    </span>
                  </td>
                  <td>
                    <div className="grid gap-1">
                      {wallet.ledger.slice(0, 3).map((entry) => (
                        <span key={entry.id} className="text-xs">
                          <span className="font-semibold">
                            {formatSignedMoney(entry.amount, entry.currency)}
                          </span>{" "}
                          <span className="text-[var(--muted)]">
                            {humanizeLabel(entry.type)} /{" "}
                            {formatDate(entry.createdAt)}
                          </span>
                        </span>
                      ))}
                      {wallet.ledger.length === 0 ? (
                        <span className="text-xs text-[var(--muted)]">
                          No movement in this window
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.wallets.length === 0 ? (
            <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No wallet accounts are available.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
