import Link from "next/link";
import { redirect } from "next/navigation";
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
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Wallet operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Admin wallet desk</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Audit seller balances, recent wallet movement, and jump into per-user
          credit or debit actions.
        </p>
      </div>

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
          href="/admin/reports/wallet-payments"
          className="action-primary px-4 py-3 text-sm font-bold"
        >
          Full wallet report
        </Link>
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

      <section className="panel overflow-x-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Wallet accounts</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Open a user to adjust balances and review their full wallet ledger.
          </p>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-3 pr-4">User</th>
              <th className="py-3 pr-4">Balance</th>
              <th className="py-3 pr-4">Net movement</th>
              <th className="py-3 pr-4">Ledger</th>
              <th className="py-3 pr-4">Last activity</th>
              <th className="py-3 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {report.wallets.map((wallet) => (
              <tr key={wallet.id} className="border-b border-[var(--line)]">
                <td className="py-3 pr-4">
                  <p className="font-bold">{wallet.user.displayName}</p>
                  <p className="text-xs text-[var(--muted)]">{wallet.user.email}</p>
                </td>
                <td className="py-3 pr-4">
                  {formatMoney(wallet.balance, wallet.currency)}
                </td>
                <td className="py-3 pr-4">
                  {formatMoney(wallet.netMovement, wallet.currency)}
                </td>
                <td className="py-3 pr-4">{wallet.ledgerEntryCount}</td>
                <td className="py-3 pr-4">{formatDate(wallet.latestLedgerAt)}</td>
                <td className="py-3 pr-4">
                  <Link
                    href={`/admin/users/${wallet.userId}`}
                    className="admin-table-action"
                  >
                    Open user wallet
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
