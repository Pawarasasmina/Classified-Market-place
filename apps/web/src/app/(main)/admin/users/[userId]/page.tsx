import Link from "next/link";
import { redirect } from "next/navigation";
import {
  creditAdminWalletAction,
  debitAdminWalletAction,
} from "@/app/(main)/actions";
import { AdminUserCard } from "@/components/marketplace/admin-user-card";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminUser, fetchAdminWallet } from "@/lib/marketplace-api";

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminUserDetailPage(
  props: AdminUserDetailPageProps
) {
  const [{ userId }, session] = await Promise.all([
    props.params,
    requireSessionContext("/admin/users"),
  ]);
  const { accessToken, user } = session;

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const [managedUser, wallet] = await Promise.all([
    fetchAdminUser(accessToken, userId),
    fetchAdminWallet(accessToken, userId),
  ]);

  return (
    <div className="admin-dashboard page">
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-kicker">User details</span>
          <h1>{managedUser.displayName}</h1>
          <p>{managedUser.email}</p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/admin/users" className="admin-panel-link">
            All users
          </Link>
          <Link
            href={`/admin/users/${managedUser.id}/listings`}
            className="admin-primary-link"
          >
            User listings
          </Link>
          <Link
            href={`/admin/users/${managedUser.id}/bookings`}
            className="admin-primary-link"
          >
            User bookings
          </Link>
        </div>
      </section>

      <section className="admin-stat-grid" aria-label="User detail summary">
        {[
          ["Listings", managedUser.adminStats.totalListings],
          ["Active", managedUser.adminStats.activeListings],
          ["Paused", managedUser.adminStats.pausedListings],
          ["Pending", managedUser.adminStats.pendingListings],
          ["Bookings", managedUser.adminStats.bookingCount],
          ["Offers", managedUser.adminStats.offerCount],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>For this user</small>
          </div>
        ))}
      </section>

      <AdminUserCard
        user={managedUser}
        returnTo={`/admin/users/${managedUser.id}`}
        expanded
      />

      <section className="panel grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-4">
          <div>
            <p className="section-eyebrow">Wallet operations</p>
            <h2 className="mt-2 text-2xl font-black">Seller wallet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Balance, ledger visibility, and direct admin adjustments for this
              account.
            </p>
          </div>
          <div className="admin-stat-grid">
            {[
              ["Balance", formatMoney(wallet.balance, wallet.currency)],
              ["Currency", wallet.currency],
              ["Entries", String(wallet.ledger?.length ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="admin-stat-card">
                <span>{label}</span>
                <strong>{value}</strong>
                <small>Wallet summary</small>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <form action={creditAdminWalletAction} className="panel grid gap-3">
              <input type="hidden" name="userId" value={managedUser.id} />
              <input
                type="hidden"
                name="returnTo"
                value={`/admin/users/${managedUser.id}`}
              />
              <h3 className="text-lg font-bold">Credit wallet</h3>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                className="surface-input w-full text-sm"
              />
              <input
                name="currency"
                defaultValue={wallet.currency}
                className="surface-input w-full text-sm uppercase"
              />
              <textarea
                name="note"
                rows={3}
                placeholder="Reason for the credit"
                className="surface-input w-full text-sm"
              />
              <button className="action-primary px-4 py-3 text-sm font-bold">
                Credit seller wallet
              </button>
            </form>
            <form action={debitAdminWalletAction} className="panel grid gap-3">
              <input type="hidden" name="userId" value={managedUser.id} />
              <input
                type="hidden"
                name="returnTo"
                value={`/admin/users/${managedUser.id}`}
              />
              <h3 className="text-lg font-bold">Debit wallet</h3>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                className="surface-input w-full text-sm"
              />
              <input
                name="currency"
                defaultValue={wallet.currency}
                className="surface-input w-full text-sm uppercase"
              />
              <textarea
                name="note"
                rows={3}
                placeholder="Reason for the debit"
                className="surface-input w-full text-sm"
              />
              <button className="action-secondary px-4 py-3 text-sm font-bold">
                Debit seller wallet
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Recent wallet ledger</h3>
            <Link
              href="/admin/reports/wallet-payments"
              className="action-secondary px-3 py-2 text-sm font-semibold"
            >
              Wallet report
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
                    <p className="font-bold">{entry.type.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatDate(entry.createdAt)} / Balance after{" "}
                      {formatMoney(entry.balanceAfter, entry.currency)}
                    </p>
                    {entry.metadata?.note ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {String(entry.metadata.note)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black">
                      {formatMoney(entry.amount, entry.currency)}
                    </p>
                    {entry.transaction ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {entry.transaction.type} / {entry.transaction.status}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
              No wallet activity yet for this user.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
