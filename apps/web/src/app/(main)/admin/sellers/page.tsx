import Link from "next/link";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { AdminTableEnhancer } from "@/components/marketplace/admin-table-enhancements";
import { AdminTablePagination } from "@/components/marketplace/admin-table-pagination";
import {
  buildAdminPaginationHref,
  getAdminPaginationHiddenFields,
  getAdminPaginationState,
  paginateAdminItems,
} from "@/lib/admin-pagination";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminSellerOverview } from "@/lib/marketplace-api";

type AdminSellersPageProps = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
  }>;
};

export default async function AdminSellersPage(props: AdminSellersPageProps) {
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/admin/sellers");
  const overview = await fetchAdminSellerOverview(accessToken);
  const pagination = getAdminPaginationState(
    searchParams,
    overview.sellers.length,
  );
  const paginatedSellers = paginateAdminItems(overview.sellers, pagination);
  const paginationParams = { pageSize: pagination.pageSize };

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Seller operations"
        title="Seller dashboard"
        description="Track seller onboarding, verified requests, badge activity, and privilege coverage."
        badge={`${overview.sellers.length} sellers`}
        actions={
          <Link
            href="/admin/sellers/approvals"
            className="action-primary px-4 py-2 text-sm font-semibold"
          >
            Review approvals
          </Link>
        }
      />
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
      <AdminTableEnhancer tableId="admin-sellers-table" copyLabel="seller IDs" />
      <div className="admin-table-wrap">
        <table id="admin-sellers-table" className="admin-table">
          <thead>
            <tr>
              <th>Seller</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Tier</th>
              <th>Listings</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSellers.map((seller) => (
              <tr key={seller.id} data-row-id={seller.id}>
                <td className="font-bold" data-label="Seller">
                  {seller.user.displayName}
                </td>
                <td data-label="Status">
                  <span
                    className="admin-status-badge"
                    data-status={seller.status.toLowerCase()}
                  >
                    {seller.status}
                  </span>
                </td>
                <td data-label="Verified">
                  <span
                    className="admin-status-badge"
                    data-status={seller.verifiedSellerStatus.toLowerCase()}
                  >
                    {seller.verifiedSellerStatus}
                  </span>
                </td>
                <td data-label="Tier">{seller.privilegeTier?.name ?? "Free"}</td>
                <td data-label="Listings">{seller.stats?.totalListings ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {overview.sellers.length === 0 ? (
          <div className="admin-empty-state">
            <p className="admin-empty-state-title">No sellers found</p>
            <p className="admin-empty-state-copy">
              Seller onboarding records will appear here once profiles are created.
            </p>
          </div>
        ) : null}
      </div>
      {overview.sellers.length > 0 ? (
        <AdminTablePagination
          buildPageHref={(page, pageSize = pagination.pageSize) =>
            buildAdminPaginationHref("/admin/sellers", paginationParams, {
              page,
              pageSize,
            })
          }
          hiddenFields={getAdminPaginationHiddenFields(paginationParams)}
          itemLabel="sellers"
          pagination={pagination}
        />
      ) : null}
    </div>
  );
}
