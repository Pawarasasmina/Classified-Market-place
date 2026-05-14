import { requireAdminSession } from "@/lib/auth-dal";
import { AdminPageHeader, AdminPanel, ChartBars, EmptyState } from "@/components/marketplace/admin-ui";

export default async function AdminPaymentsPage() {
  await requireAdminSession("/admin/payments");

  const transactions = [
    { id: "TX-9012", type: "Boost purchase", amount: "AED 48", status: "successful" },
    { id: "TX-9011", type: "Pay-to-post", amount: "AED 12", status: "pending" },
    { id: "TX-9009", type: "Subscription", amount: "AED 129", status: "successful" },
    { id: "TX-9002", type: "Lead credits", amount: "AED 35", status: "refunded" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Payment & Revenue"
        title="Track transactions, revenue, and payment health."
        description="Monitor pay-to-post, subscriptions, boosts, and lead credit purchases with export-ready transaction views."
      />

      <ChartBars
        title="Revenue analytics"
        data={[
          { label: "Pay-to-post", value: 18 },
          { label: "Subscriptions", value: 41 },
          { label: "Boosts", value: 52 },
          { label: "Lead credits", value: 24 },
        ]}
      />

      <AdminPanel title="Transactions table" action={<button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Export CSV</button>}>
        {transactions.length ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="grid gap-2 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 md:grid-cols-[0.22fr_0.38fr_0.2fr_0.2fr]">
                <p className="font-semibold text-[var(--foreground)]">{tx.id}</p>
                <p className="text-sm text-[var(--muted)]">{tx.type}</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">{tx.amount}</p>
                <p className="text-sm capitalize text-[var(--muted)]">{tx.status}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No transaction data available." />
        )}
      </AdminPanel>
    </div>
  );
}
