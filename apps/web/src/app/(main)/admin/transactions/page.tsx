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
    page?: string;
    pageSize?: string;
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
  const pagination = getAdminPaginationState(
    searchParams,
    transactions.length,
  );
  const paginatedTransactions = paginateAdminItems(transactions, pagination);
  const paginationParams = {
    status,
    type,
    userId,
    listingId,
    pageSize: pagination.pageSize,
  };
  const succeededTotal = transactions
    .filter((transaction) => transaction.status === "SUCCEEDED")
    .reduce((sum, transaction) => sum + transaction.amountValue, 0);

  return (
    <div className="page admin-dashboard grid gap-6">
      <AdminPageHeader
        eyebrow="Payments"
        title="Transaction ledger"
        description="Audit boost purchases, failed payments, refunds, and provider references."
        badge={`${transactions.length} transactions`}
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

      <form className="panel admin-filter-bar grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr_1.3fr_auto] lg:items-end">
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

      <AdminTableEnhancer
        tableId="admin-transactions-table"
        copyLabel="transaction IDs"
      />
      <div className="admin-table-wrap">
        <table id="admin-transactions-table" className="admin-table">
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
            {paginatedTransactions.map((transaction) => (
              <tr key={transaction.id} data-row-id={transaction.id}>
                <td data-label="Transaction">
                  <span className="font-semibold">{transaction.typeLabel}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {transaction.id}
                  </span>
                </td>
                <td data-label="User">
                  <span className="font-semibold">
                    {transaction.userDisplayName ?? transaction.userId}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {transaction.userEmail ?? transaction.userId}
                  </span>
                </td>
                <td data-label="Listing">
                  {transaction.listingTitle ?? transaction.listingId ?? "None"}
                </td>
                <td data-label="Status">
                  <span
                    className="admin-status-badge"
                    data-status={transaction.status.toLowerCase()}
                  >
                    {transaction.statusLabel}
                  </span>
                </td>
                <td data-label="Amount">{transaction.amountLabel}</td>
                <td data-label="Provider">
                  {transaction.provider ?? "None"}
                  <span className="block text-xs text-[var(--muted)]">
                    {transaction.providerRef ?? "No ref"}
                  </span>
                </td>
                <td data-label="Date">{transaction.createdLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 ? (
          <div className="admin-empty-state">
            <p className="admin-empty-state-title">No transactions found</p>
            <p className="admin-empty-state-copy">
              Adjust the status, type, user, or listing filters to broaden the ledger.
            </p>
          </div>
        ) : null}
      </div>
      {transactions.length > 0 ? (
        <AdminTablePagination
          buildPageHref={(page, pageSize = pagination.pageSize) =>
            buildAdminPaginationHref("/admin/transactions", paginationParams, {
              page,
              pageSize,
            })
          }
          hiddenFields={getAdminPaginationHiddenFields(paginationParams)}
          itemLabel="transactions"
          pagination={pagination}
        />
      ) : null}
    </div>
  );
}
