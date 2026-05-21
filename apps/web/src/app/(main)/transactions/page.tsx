import Link from "next/link";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchMyTransactions } from "@/lib/marketplace-api";
import {
  type ApiTransactionStatus,
  type ApiTransactionType,
} from "@/lib/marketplace";

type TransactionsPageProps = {
  searchParams: Promise<{
    status?: ApiTransactionStatus;
    type?: ApiTransactionType;
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
  "REFUND",
];

function formatFilterLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function TransactionsPage(props: TransactionsPageProps) {
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/transactions");
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
  const transactions = await fetchMyTransactions(accessToken, {
    status,
    type,
    take: 100,
  });
  const totalSpend = transactions
    .filter((transaction) => transaction.status === "SUCCEEDED")
    .reduce((sum, transaction) => sum + transaction.amountValue, 0);

  return (
    <div className="page grid gap-6">
      <div className="panel-dark flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="section-eyebrow">Payment history</p>
          <h1 className="mt-2 text-3xl font-black text-white">Purchases</h1>
          <p className="mt-2 max-w-3xl text-[#d7d9ea]">
            Review boost purchases, payment status, refunds, and linked listings
            for your account.
          </p>
        </div>
        <Link
          href="/my-listings"
          className="rounded-md bg-white px-4 py-3 text-sm font-bold text-[var(--foreground)]"
        >
          Manage listings
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Transactions", transactions.length],
          [
            "Successful",
            transactions.filter((item) => item.status === "SUCCEEDED").length,
          ],
          ["Spent", `AED ${totalSpend.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <form className="panel grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="surface-input"
          >
            <option value="">All statuses</option>
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
            <option value="">All types</option>
            {transactionTypes.map((item) => (
              <option key={item} value={item}>
                {formatFilterLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <button className="action-primary px-4 py-3 text-sm font-black">
          Filter
        </button>
      </form>

      <section className="grid gap-3">
        {transactions.length ? (
          transactions.map((transaction) => (
            <article
              key={transaction.id}
              className="panel grid gap-4 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black">{transaction.typeLabel}</h2>
                  <span className="admin-status-badge">
                    {transaction.statusLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {transaction.listingTitle ?? "Marketplace payment"} /{" "}
                  {transaction.createdLabel}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  {transaction.provider ?? "provider"} /{" "}
                  {transaction.providerRef ?? transaction.id}
                </p>
              </div>
              <div className="grid gap-2 text-left md:text-right">
                <p className="text-2xl font-black">{transaction.amountLabel}</p>
                {transaction.listingId ? (
                  <Link
                    href={`/listings/${transaction.listingId}`}
                    className="action-secondary px-3 py-2 text-center text-sm font-black"
                  >
                    View listing
                  </Link>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="panel py-12 text-center">
            <h2 className="text-xl font-black">No purchases yet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Boost payments and refunds will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
