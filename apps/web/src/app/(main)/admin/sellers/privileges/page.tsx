import {
  applyDefaultSellerPrivilegeQuotasAction,
  upsertSellerPrivilegeQuotaAction,
  upsertSellerPrivilegeTierAction,
  zeroAllSellerPrivilegeQuotasAction,
} from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminFormSection } from "@/components/marketplace/admin-form-section";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminCategories,
  fetchAdminSellerPrivileges,
} from "@/lib/marketplace-api";

type AdminSellerPrivilegesPageProps = {
  searchParams: Promise<{
    message?: string;
    quota?: string;
    tier?: string;
  }>;
};

export default async function AdminSellerPrivilegesPage(
  props: AdminSellerPrivilegesPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/admin/sellers/privileges");
  const [tiers, categories] = await Promise.all([
    fetchAdminSellerPrivileges(accessToken),
    fetchAdminCategories(accessToken),
  ]);

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Seller operations"
        title="Seller privileges"
        description="Manage seller tiers, listing limits, paid fees, and per-category quota overrides."
        badge={`${tiers.length} tiers`}
      />
      <AdminActionFeedback
        status={searchParams.tier ?? searchParams.quota}
        message={searchParams.message}
        messages={{
          saved: searchParams.tier
            ? "Seller privilege tier saved."
            : "Category quota saved.",
          applied: "Default quotas applied to all categories.",
          zeroed: "All quotas set to zero.",
          invalid: "Choose a seller tier before submitting.",
        }}
        successStatuses={["saved", "applied", "zeroed"]}
      />
      <form action={upsertSellerPrivilegeTierAction} className="panel admin-form-card">
        <input type="hidden" name="returnTo" value="/admin/sellers/privileges" />
        <AdminFormSection
          title="Tier identity"
          copy="Choose the platform tier code and the public label sellers will see."
        >
          <div className="admin-form-grid md:grid-cols-3">
            <label className="admin-field">
              <span className="admin-field-label">Code</span>
              <select name="code" className="surface-input w-full text-sm">
                <option value="FREE">FREE</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="VIP">VIP</option>
              </select>
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Tier name</span>
              <input name="name" placeholder="Tier name" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Slug</span>
              <input name="slug" placeholder="Slug" className="surface-input w-full text-sm" />
            </label>
          </div>
        </AdminFormSection>

        <AdminFormSection
          title="Default limits and fees"
          copy="These defaults apply unless a category-specific quota overrides them."
        >
          <div className="admin-form-grid sm:grid-cols-2 xl:grid-cols-3">
            <label className="admin-field">
              <span className="admin-field-label">Monthly free limit</span>
              <input name="monthlyFreeListingLimit" type="number" placeholder="Monthly free limit" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Active limit</span>
              <input name="activeListingLimit" type="number" placeholder="Active limit" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Pending limit</span>
              <input name="pendingListingLimit" type="number" placeholder="Pending limit" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Paid listing fee</span>
              <input name="paidListingFee" type="number" step="0.01" placeholder="Paid listing fee" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Upgrade fee</span>
              <input name="sellerLevelUpgradeFee" type="number" step="0.01" placeholder="Upgrade fee" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Currency</span>
              <input name="currency" defaultValue="AED" className="surface-input w-full text-sm" />
            </label>
          </div>
        </AdminFormSection>

        <AdminSubmitButton pendingText="Saving tier...">
          Save privilege tier
        </AdminSubmitButton>
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
                <AdminSubmitButton
                  className="action-secondary px-4 py-3 text-sm font-bold"
                  confirmMessage={`Apply ${tier.name}'s default quotas to every category? Existing category overrides may be replaced.`}
                  pendingText="Applying defaults..."
                >
                  Apply defaults to all categories
                </AdminSubmitButton>
              </form>
              <form action={zeroAllSellerPrivilegeQuotasAction}>
                <input type="hidden" name="returnTo" value="/admin/sellers/privileges" />
                <input type="hidden" name="sellerPrivilegeTierId" value={tier.id} />
                <AdminSubmitButton
                  className="action-secondary px-4 py-3 text-sm font-bold"
                  confirmMessage={`Set every category quota for ${tier.name} to zero? This can block seller listings for this tier.`}
                  pendingText="Zeroing quotas..."
                >
                  Set all quotas to zero
                </AdminSubmitButton>
              </form>
            </div>
          </div>
          <form action={upsertSellerPrivilegeQuotaAction} className="admin-form-card admin-form-card-compact">
            <input type="hidden" name="returnTo" value="/admin/sellers/privileges" />
            <input type="hidden" name="sellerPrivilegeTierId" value={tier.id} />
            <AdminFormSection
              title="Category quota override"
              copy="Override the selected tier only for one category branch."
            >
              <div className="admin-form-grid md:grid-cols-5">
                <label className="admin-field">
                  <span className="admin-field-label">Category</span>
                  <select name="categoryId" className="surface-input w-full text-sm">
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Monthly free</span>
                  <input name="monthlyFreeListingLimit" type="number" placeholder="Monthly free" className="surface-input w-full text-sm" />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Active</span>
                  <input name="activeListingLimit" type="number" placeholder="Active" className="surface-input w-full text-sm" />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Pending</span>
                  <input name="pendingListingLimit" type="number" placeholder="Pending" className="surface-input w-full text-sm" />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Paid fee</span>
                  <input name="paidListingFee" type="number" step="0.01" placeholder="Paid fee" className="surface-input w-full text-sm" />
                </label>
              </div>
            </AdminFormSection>
            <AdminSubmitButton pendingText="Saving quota...">
              Save category quota
            </AdminSubmitButton>
          </form>
        </div>
      ))}
    </div>
  );
}
