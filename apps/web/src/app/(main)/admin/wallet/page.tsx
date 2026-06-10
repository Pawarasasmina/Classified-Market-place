import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchWalletPaymentsReport } from "@/lib/marketplace-api";

function formatMoney(value: number, currency = "AED") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminWalletPage() {
  const { accessToken, user } = await requireSessionContext("/admin/wallet");

  if (!hasAdminPermission(user.role, "WALLETS_WRITE")) {
    redirect("/");
  }

  const report = await fetchWalletPaymentsReport(accessToken, {
    days: 30,
    take: 50,
  });

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Wallet operations"
        title="Admin wallet desk"
        description="Audit seller balances, recent wallet movement, and jump into per-user credit or debit actions."
        badge={formatMoney(report.overview.totalBalance)}
        actions={
          <Link
            href="/admin/reports/wallet-payments"
            className="action-primary px-4 py-2 text-sm font-semibold"
          >
            Full wallet report
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Wallets", String(report.overview.totalWallets)],
          ["Funded", String(report.overview.fundedWallets)],
          ["Total balance", formatMoney(report.overview.totalBalance)],
          ["Credit flow", formatMoney(report.movement.creditAmount)],
          ["Debit flow", formatMoney(report.movement.debitAmount)],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              Last 30 days
            </p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/transactions?type=WALLET_TOP_UP"
          className="action-secondary px-4 py-3 text-sm font-bold"
        >
          Wallet top-ups
        </Link>
        <Link
          href="/admin/transactions?type=ADMIN_CREDIT"
          className="action-secondary px-4 py-3 text-sm font-bold"
        >
          Admin credits
        </Link>
        <Link
          href="/admin/transactions?type=ADMIN_DEBIT"
          className="action-secondary px-4 py-3 text-sm font-bold"
        >
          Admin debits
        </Link>
      </div>

      <section className="panel grid gap-4">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Wallet accounts</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Open a user to adjust balances and review their full wallet ledger.
          </p>
        </div>
        <AdminTableEnhancer
          tableId="admin-wallet-table"
          copyLabel="user IDs"
          stickyActions
        />
        <div className="admin-table-wrap">
          <table id="admin-wallet-table" className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Balance</th>
                <th>Net movement</th>
                <th>Ledger</th>
                <th>Last activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {report.wallets.map((wallet) => (
                <tr key={wallet.id} data-row-id={wallet.userId}>
                  <td data-label="User">
                    <p className="font-bold">{wallet.user.displayName}</p>
                    <p className="text-xs text-[var(--muted)]">{wallet.user.email}</p>
                  </td>
                  <td data-label="Balance">{formatMoney(wallet.balance, wallet.currency)}</td>
                  <td data-label="Net movement">{formatMoney(wallet.netMovement, wallet.currency)}</td>
                  <td data-label="Ledger">{wallet.ledgerEntryCount}</td>
                  <td data-label="Last activity">{formatDate(wallet.latestLedgerAt)}</td>
                  <td data-label="Actions">
                    <div className="admin-row-actions">
                      <Link
                        href={`/admin/users/${wallet.userId}`}
                        className="admin-table-action"
                      >
                        Open user wallet
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.wallets.length === 0 ? (
            <div className="admin-empty-state">
              <p className="admin-empty-state-title">No wallets found</p>
              <p className="admin-empty-state-copy">
                Wallet accounts will appear here after users receive balances or ledger activity.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
