import {
  assignSellerBadgeAction,
  removeSellerBadgeAction,
  upsertSellerBadgeTypeAction,
} from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminFormSection } from "@/components/marketplace/admin-form-section";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminSellerBadges,
  fetchAdminSellerProfiles,
} from "@/lib/marketplace-api";

type AdminSellerBadgesPageProps = {
  searchParams: Promise<{
    badge?: string;
    badgeAssign?: string;
    message?: string;
  }>;
};

export default async function AdminSellerBadgesPage(
  props: AdminSellerBadgesPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/admin/sellers/badges");
  const [badges, sellers] = await Promise.all([
    fetchAdminSellerBadges(accessToken),
    fetchAdminSellerProfiles(accessToken, { take: 100 }),
  ]);

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Seller operations"
        title="Seller badges"
        description="Create badge types, tune badge visibility, and assign badges to seller profiles."
        badge={`${badges.length} badge types`}
      />
      <AdminActionFeedback
        status={searchParams.badge ?? searchParams.badgeAssign}
        message={searchParams.message}
        messages={{
          saved: searchParams.badge
            ? "Badge type saved."
            : "Badge assigned to seller.",
          removed: "Badge removed from seller.",
          invalid: "Choose a seller and badge before submitting.",
        }}
        successStatuses={["saved", "removed"]}
      />
      <form action={upsertSellerBadgeTypeAction} className="panel admin-form-card">
        <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
        <AdminFormSection
          title="Badge content"
          copy="Create the label, slug, and short description before tuning the badge colors."
        >
          <div className="admin-form-grid md:grid-cols-3">
            <label className="admin-field">
              <span className="admin-field-label">Badge label</span>
              <input name="label" placeholder="Badge label" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Slug</span>
              <input name="slug" placeholder="Slug" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Icon</span>
              <input name="icon" placeholder="Icon" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field md:col-span-3">
              <span className="admin-field-label">Description</span>
              <input name="description" placeholder="Description" className="surface-input w-full text-sm" />
            </label>
          </div>
        </AdminFormSection>
        <AdminFormSection
          title="Preview styling"
          copy="Use hex values to keep badge colors consistent with marketplace surfaces."
        >
          <div className="admin-form-grid md:grid-cols-2">
            <label className="admin-field">
              <span className="admin-field-label">Background color</span>
              <input name="backgroundColor" placeholder="#eef2ff" className="surface-input w-full text-sm" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Text color</span>
              <input name="textColor" placeholder="#1f2937" className="surface-input w-full text-sm" />
            </label>
          </div>
        </AdminFormSection>
        <AdminSubmitButton pendingText="Saving badge type...">
          Save badge type
        </AdminSubmitButton>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {badges.map((badge) => (
          <div key={badge.id} className="panel grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{badge.label}</h2>
                <p className="text-sm text-[var(--muted)]">{badge.slug}</p>
              </div>
              <span
                className="rounded-md px-3 py-2 text-xs font-black"
                style={{
                  background: badge.backgroundColor ?? "#eef2ff",
                  color: badge.textColor ?? "#1f2937",
                }}
              >
                Preview
              </span>
            </div>
            <form action={upsertSellerBadgeTypeAction} className="admin-form-card admin-form-card-compact">
              <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
              <input type="hidden" name="id" value={badge.id} />
              <AdminFormSection title="Badge settings" copy="Update the badge label and visibility without leaving this card.">
                <div className="admin-form-grid md:grid-cols-2">
                  <label className="admin-field">
                    <span className="admin-field-label">Label</span>
                    <input
                      name="label"
                      defaultValue={badge.label}
                      className="surface-input w-full text-sm"
                    />
                  </label>
                  <label className="admin-field">
                    <span className="admin-field-label">Slug</span>
                    <input
                      name="slug"
                      defaultValue={badge.slug}
                      className="surface-input w-full text-sm"
                    />
                  </label>
                  <label className="admin-field">
                    <span className="admin-field-label">Icon</span>
                    <input
                      name="icon"
                      defaultValue={badge.icon ?? ""}
                      className="surface-input w-full text-sm"
                    />
                  </label>
                  <label className="admin-field">
                    <span className="admin-field-label">Background color</span>
                    <input
                      name="backgroundColor"
                      defaultValue={badge.backgroundColor ?? ""}
                      className="surface-input w-full text-sm"
                    />
                  </label>
                  <label className="admin-field">
                    <span className="admin-field-label">Text color</span>
                    <input
                      name="textColor"
                      defaultValue={badge.textColor ?? ""}
                      className="surface-input w-full text-sm"
                    />
                  </label>
                  <label className="admin-field md:col-span-2">
                    <span className="admin-field-label">Description</span>
                    <textarea
                      name="description"
                      defaultValue={badge.description ?? ""}
                      rows={3}
                      className="surface-input min-h-20 w-full text-sm"
                    />
                  </label>
                </div>
                <div className="admin-form-grid sm:grid-cols-2">
                  <label className="admin-toggle">
                    <span className="admin-toggle-copy">
                      <span>Active</span>
                      <span>Allow this badge type to be assigned.</span>
                    </span>
                    <span>
                      <input type="hidden" name="isActive" value="false" />
                      <input
                        type="checkbox"
                        name="isActive"
                        value="true"
                        defaultChecked={badge.isActive}
                      />
                    </span>
                  </label>
                  <label className="admin-toggle">
                    <span className="admin-toggle-copy">
                      <span>Hidden</span>
                      <span>Keep assigned badges out of public display.</span>
                    </span>
                    <input
                      type="checkbox"
                      name="isHidden"
                      value="true"
                      defaultChecked={badge.isHidden}
                    />
                  </label>
                </div>
              </AdminFormSection>
              <AdminSubmitButton
                className="action-secondary px-4 py-3 text-sm font-bold"
                pendingText="Saving badge..."
              >
                Save badge settings
              </AdminSubmitButton>
            </form>
            <form action={assignSellerBadgeAction} className="admin-form-section">
              <div className="admin-form-section-head">
                <h3 className="admin-form-section-title">Assign to seller</h3>
                <p className="admin-form-section-copy">
                  Select a seller profile and attach this badge.
                </p>
              </div>
              <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
              <input type="hidden" name="badgeTypeId" value={badge.id} />
              <div className="admin-form-grid sm:grid-cols-[1fr_auto]">
                <label className="admin-field">
                  <span className="admin-field-label">Seller</span>
                  <select name="sellerProfileId" className="surface-input w-full text-sm">
                    {sellers.map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.user.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <AdminSubmitButton
                  className="action-secondary px-4 py-3 text-sm font-bold sm:self-end"
                  pendingText="Assigning badge..."
                >
                  Assign badge
                </AdminSubmitButton>
              </div>
            </form>
            {sellers.flatMap((seller) =>
              (seller.badges ?? [])
                .filter((assignment) => assignment.badgeType.id === badge.id)
                .map((assignment) => (
                  <form
                    key={assignment.id}
                    action={removeSellerBadgeAction}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] p-3 text-sm"
                  >
                    <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
                    <input type="hidden" name="sellerProfileId" value={seller.id} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <span>{seller.user.displayName}</span>
                    <AdminSubmitButton
                      className="text-sm font-bold text-[#b93820]"
                      confirmMessage={`Remove this badge from ${seller.user.displayName}?`}
                      pendingText="Removing..."
                    >
                      Remove
                    </AdminSubmitButton>
                  </form>
                )),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
