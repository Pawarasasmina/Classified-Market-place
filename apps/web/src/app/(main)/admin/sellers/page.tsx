import Link from "next/link";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminSellerOverview } from "@/lib/marketplace-api";

export default async function AdminSellersPage() {
  const { accessToken } = await requireSessionContext("/admin/sellers");
  const overview = await fetchAdminSellerOverview(accessToken);

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller Operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Seller dashboard</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Track seller onboarding, verified requests, badge activity, and privilege coverage.
        </p>
      </div>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(overview.stats).map(([label, value]) => (
          <div key={label} className="panel">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["/admin/sellers/approvals", "Approvals"],
          ["/admin/sellers/verified", "Verified queue"],
          ["/admin/sellers/badges", "Badge manager"],
          ["/admin/sellers/privileges", "Privilege tiers"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="panel font-bold">
            {label}
          </Link>
        ))}
      </section>
      <div className="panel overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-3 pr-4">Seller</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Verified</th>
              <th className="py-3 pr-4">Tier</th>
              <th className="py-3 pr-4">Listings</th>
            </tr>
          </thead>
          <tbody>
            {overview.sellers.map((seller) => (
              <tr key={seller.id} className="border-b border-[var(--line)]">
                <td className="py-3 pr-4 font-bold">{seller.user.displayName}</td>
                <td className="py-3 pr-4">{seller.status}</td>
                <td className="py-3 pr-4">{seller.verifiedSellerStatus}</td>
                <td className="py-3 pr-4">{seller.privilegeTier?.name ?? "Free"}</td>
                <td className="py-3 pr-4">{seller.stats?.totalListings ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
