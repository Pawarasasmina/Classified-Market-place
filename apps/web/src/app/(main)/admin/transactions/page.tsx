import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminTransactions } from "@/lib/marketplace-api";
import {
  type ApiTransactionStatus,
  type ApiTransactionType,
} from "@/lib/marketplace";

type AdminTransactionsPageProps = {
  searchParams: Promise<{
    status?: ApiTransactionStatus;
    type?: ApiTransactionType;
    userId?: string;
    listingId?: string;
  }>;
};

const transactionStatuses: ApiTransactionStatus[] = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

const transactionTypes: ApiTransactionType[] = [
  "BOOST_PURCHASE",
  "LISTING_FEE",
  "WALLET_TOP_UP",
  "ADMIN_ADJUSTMENT",
  "REFUND",
];

function formatFilterLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AdminTransactionsPage(
  props: AdminTransactionsPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/transactions",
  );

  if (!hasAdminPermission(user.role, "TRANSACTIONS_READ")) {
    redirect("/");
  }

  const status = transactionStatuses.includes(
    searchParams.status as ApiTransactionStatus,
  )
    ? searchParams.status
    : undefined;
  const type = transactionTypes.includes(
    searchParams.type as ApiTransactionType,
  )
    ? searchParams.type
    : undefined;
  const userId = searchParams.userId?.trim() || undefined;
  const listingId = searchParams.listingId?.trim() || undefined;
  const transactions = await fetchAdminTransactions(accessToken, {
    status,
    type,
    userId,
    listingId,
    take: 100,
  });
  const succeededTotal = transactions
    .filter((transaction) => transaction.status === "SUCCEEDED")
    .reduce((sum, transaction) => sum + transaction.amountValue, 0);

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Payments
          </p>
          <h1 className="mt-1 text-2xl font-bold">Transaction ledger</h1>
          <p className="mt-2 text-[var(--muted)]">
            Audit boost purchases, failed payments, refunds, and provider
            references.
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
          ["Transactions", transactions.length],
          ["Succeeded total", `AED ${succeededTotal.toLocaleString()}`],
          [
            "Refunded",
            transactions.filter((item) => item.status === "REFUNDED").length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <form className="panel grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr_1.3fr_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="surface-input"
          >
            <option value="">All</option>
            {transactionStatuses.map((item) => (
              <option key={item} value={item}>
                {formatFilterLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Type
          <select
            name="type"
            defaultValue={type ?? ""}
            className="surface-input"
          >
            <option value="">All</option>
            {transactionTypes.map((item) => (
              <option key={item} value={item}>
                {formatFilterLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          User ID
          <input
            name="userId"
            defaultValue={userId ?? ""}
            className="surface-input"
            placeholder="UUID"
          />
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
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>User</th>
              <th>Listing</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Provider</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>
                  <span className="font-semibold">{transaction.typeLabel}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {transaction.id}
                  </span>
                </td>
                <td>
                  <span className="font-semibold">
                    {transaction.userDisplayName ?? transaction.userId}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {transaction.userEmail ?? transaction.userId}
                  </span>
                </td>
                <td>
                  {transaction.listingTitle ?? transaction.listingId ?? "None"}
                </td>
                <td>
                  <span className="admin-status-badge">
                    {transaction.statusLabel}
                  </span>
                </td>
                <td>{transaction.amountLabel}</td>
                <td>
                  {transaction.provider ?? "None"}
                  <span className="block text-xs text-[var(--muted)]">
                    {transaction.providerRef ?? "No ref"}
                  </span>
                </td>
                <td>{transaction.createdLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 ? (
          <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
            No transactions match those filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
