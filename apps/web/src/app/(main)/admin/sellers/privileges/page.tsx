import {
  applyDefaultSellerPrivilegeQuotasAction,
  upsertSellerPrivilegeQuotaAction,
  upsertSellerPrivilegeTierAction,
  zeroAllSellerPrivilegeQuotasAction,
} from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminCategories,
  fetchAdminSellerPrivileges,
} from "@/lib/marketplace-api";

export default async function AdminSellerPrivilegesPage() {
  const { accessToken } = await requireSessionContext("/admin/sellers/privileges");
  const [tiers, categories] = await Promise.all([
    fetchAdminSellerPrivileges(accessToken),
    fetchAdminCategories(accessToken),
  ]);

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller Operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Seller privileges</h1>
      </div>
      <form action={upsertSellerPrivilegeTierAction} className="panel grid gap-3 md:grid-cols-3">
        <input type="hidden" name="returnTo" value="/admin/sellers/privileges" />
        <select name="code" className="surface-input w-full text-sm">
          <option value="FREE">FREE</option>
          <option value="PREMIUM">PREMIUM</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="VIP">VIP</option>
        </select>
        <input name="name" placeholder="Tier name" className="surface-input w-full text-sm" />
        <input name="slug" placeholder="Slug" className="surface-input w-full text-sm" />
        <input name="monthlyFreeListingLimit" type="number" placeholder="Monthly free limit" className="surface-input w-full text-sm" />
        <input name="activeListingLimit" type="number" placeholder="Active limit" className="surface-input w-full text-sm" />
        <input name="pendingListingLimit" type="number" placeholder="Pending limit" className="surface-input w-full text-sm" />
        <input name="paidListingFee" type="number" step="0.01" placeholder="Paid listing fee" className="surface-input w-full text-sm" />
        <input name="sellerLevelUpgradeFee" type="number" step="0.01" placeholder="Upgrade fee" className="surface-input w-full text-sm" />
        <input name="currency" defaultValue="AED" className="surface-input w-full text-sm" />
        <button className="action-primary px-4 py-3 text-sm font-bold md:col-span-3">
          Save privilege tier
        </button>
      </form>
      {tiers.map((tier) => (
        <div key={tier.id} className="panel grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{tier.name}</h2>
              <p className="text-sm text-[var(--muted)]">
                {tier.code} / {tier.currency} / free {tier.monthlyFreeListingLimit}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={applyDefaultSellerPrivilegeQuotasAction}>
                <input type="hidden" name="returnTo" value="/admin/sellers/privileges" />
                <input type="hidden" name="sellerPrivilegeTierId" value={tier.id} />
                <button className="action-secondary px-4 py-3 text-sm font-bold">
                  Apply defaults to all categories
                </button>
              </form>
              <form action={zeroAllSellerPrivilegeQuotasAction}>
                <input type="hidden" name="returnTo" value="/admin/sellers/privileges" />
                <input type="hidden" name="sellerPrivilegeTierId" value={tier.id} />
                <button className="action-secondary px-4 py-3 text-sm font-bold">
                  Set all quotas to zero
                </button>
              </form>
            </div>
          </div>
          <form action={upsertSellerPrivilegeQuotaAction} className="grid gap-3 md:grid-cols-5">
            <input type="hidden" name="returnTo" value="/admin/sellers/privileges" />
            <input type="hidden" name="sellerPrivilegeTierId" value={tier.id} />
            <select name="categoryId" className="surface-input w-full text-sm">
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input name="monthlyFreeListingLimit" type="number" placeholder="Monthly free" className="surface-input w-full text-sm" />
            <input name="activeListingLimit" type="number" placeholder="Active" className="surface-input w-full text-sm" />
            <input name="pendingListingLimit" type="number" placeholder="Pending" className="surface-input w-full text-sm" />
            <input name="paidListingFee" type="number" step="0.01" placeholder="Paid fee" className="surface-input w-full text-sm" />
            <button className="action-primary px-4 py-3 text-sm font-bold md:col-span-5">
              Save category quota
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
