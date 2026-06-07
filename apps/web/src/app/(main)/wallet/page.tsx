import Link from "next/link";
import { walletTopUpAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchBoostPackages,
  fetchMyTransactions,
  fetchMyWallet,
} from "@/lib/marketplace-api";

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);

  return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString() : value}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function humanizeLedgerType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function WalletPage() {
  const { accessToken } = await requireSessionContext("/wallet");
  const [wallet, transactions, boostPackages] = await Promise.all([
    fetchMyWallet(accessToken),
    fetchMyTransactions(accessToken, { take: 12 }),
    fetchBoostPackages(),
  ]);
  const walletBalance = Number(wallet.balance);
  const affordableBoosts = boostPackages.filter((boostPackage) => {
    const price = Number(boostPackage.price);

    return (
      boostPackage.currency === wallet.currency &&
      Number.isFinite(price) &&
      Number.isFinite(walletBalance) &&
      price <= walletBalance
    );
  }).length;

  return (
    <div className="page grid gap-6">
      <section className="panel-dark p-6">
        <p className="section-eyebrow">Seller wallet</p>
        <h1 className="mt-2 text-3xl font-black text-white">Wallet balance</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Keep listing fees, boosts, and future seller upgrades funded from one
          balance.
        </p>
      </section>

      <section className="panel grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-4xl font-black">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
              Currency {wallet.currency}
            </span>
            <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
              {affordableBoosts} boost packages affordable
            </span>
          </div>
          <form action={walletTopUpAction} className="mt-5 grid gap-2 sm:max-w-sm">
            <input type="hidden" name="returnTo" value="/wallet" />
            <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
              Top-up amount
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="100"
                  className="surface-input rounded-md px-3 py-2 text-sm font-bold"
                />
                <input
                  name="currency"
                  defaultValue={wallet.currency}
                  maxLength={3}
                  className="surface-input rounded-md px-3 py-2 text-sm font-bold uppercase"
                />
              </div>
            </label>
            <button className="action-primary px-3 py-2 text-sm font-black">
              Top up wallet
            </button>
          </form>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
              Recent wallet activity
            </p>
            <Link
              href="/transactions"
              className="action-secondary px-3 py-2 text-sm font-semibold"
            >
              View all transactions
            </Link>
          </div>
          {wallet.ledger?.length ? (
            wallet.ledger.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{humanizeLedgerType(entry.type)}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatDate(entry.createdAt)} / Balance after{" "}
                      {formatMoney(entry.balanceAfter, entry.currency)}
                    </p>
                    {entry.transaction ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {entry.transaction.type} / {entry.transaction.status}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-lg font-black">
                    {formatMoney(entry.amount, entry.currency)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
              No wallet activity yet.
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Recent payment activity</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Listing fees, boosts, and top-ups tied to your account.
            </p>
          </div>
          <Link href="/my-listings" className="action-secondary px-3 py-2 text-sm font-semibold">
            Back to my listings
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          {transactions.length ? (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{transaction.typeLabel}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {transaction.statusLabel} / {transaction.createdLabel}
                    </p>
                    {transaction.listingTitle ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {transaction.listingTitle}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-lg font-black">{transaction.amountLabel}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
              No wallet-related transactions yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
