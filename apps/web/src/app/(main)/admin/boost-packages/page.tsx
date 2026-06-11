import { redirect } from "next/navigation";
import {
  createBoostPackageAction,
  deleteBoostPackageAction,
  updateBoostPackageAction,
} from "@/app/(main)/actions";
import { AdminFormSection } from "@/components/marketplace/admin-form-section";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminBoostPackages,
  fetchAdminCategories,
  fetchAdminPriorityRules,
} from "@/lib/marketplace-api";
import {
  humanizeBoostPlacement,
  type ApiBoostPlacement,
} from "@/lib/marketplace";

const boostPlacements: ApiBoostPlacement[] = [
  "TOP_LISTING",
  "HIGHLIGHTED_LISTING",
  "CATEGORY_PRIORITY",
  "HOMEPAGE_PROMOTION",
  "TIME_BASED_BOOST",
];

type AdminBoostPackagesPageProps = {
  searchParams: Promise<{
    message?: string;
    package?: string;
  }>;
};

function formatMoney(price: string | number, currency: string) {
  const amount = Number(price);

  return `${currency} ${Number.isNaN(amount) ? price : amount.toLocaleString()}`;
}

function formatAvailability(categoryCount: number) {
  return categoryCount > 0
    ? `${categoryCount} ${categoryCount === 1 ? "category" : "categories"}`
    : "All categories";
}

export default async function AdminBoostPackagesPage(
  props: AdminBoostPackagesPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/boost-packages",
  );

  if (!hasAdminPermission(user.role, "BOOSTS_WRITE")) {
    redirect("/");
  }

  const [boostPackages, categories, priorityRules] = await Promise.all([
    fetchAdminBoostPackages(accessToken),
    fetchAdminCategories(accessToken),
    fetchAdminPriorityRules(accessToken),
  ]);
  const activeCount = boostPackages.filter((item) => item.isActive).length;
  const packagePriorityRules = new Map(
    priorityRules
      .filter((rule) => rule.target === "BOOST_PACKAGE" && rule.boostPackageId)
      .map((rule) => [rule.boostPackageId, rule]),
  );

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Boost revenue setup"
        title="Boost Packages"
        description="Configure the packages sellers can buy, including placement, price, duration, visibility, and their ranking weight in customer results."
        badge={`${activeCount} active / ${boostPackages.length} total`}
      />

      <AdminActionFeedback
        status={searchParams.package}
        message={searchParams.message}
        messages={{
          created: "Boost package created.",
          updated: "Boost package updated.",
          deleted: "Boost package disabled.",
          invalid: "Check the package fields and try again.",
        }}
        successStatuses={["created", "updated", "deleted"]}
      />

      <section className="panel">
        <div className="admin-form-section-head">
          <h2 className="text-xl font-bold">Create package</h2>
          <p className="admin-form-section-copy">
            Start with the package identity, then define price, ranking weight,
            and where sellers can use it.
          </p>
        </div>
        <form
          action={createBoostPackageAction}
          className="admin-form-card mt-4"
        >
          <AdminFormSection
            title="Package details"
            copy="Name the package and choose the placement sellers are buying."
          >
            <div className="admin-form-grid md:grid-cols-2">
              <label className="admin-field">
                <span className="admin-field-label">Name</span>
                <input name="name" className="surface-input" required />
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Placement</span>
                <select name="placement" className="surface-input">
                  {boostPlacements.map((placement) => (
                    <option key={placement} value={placement}>
                      {humanizeBoostPlacement(placement)}
                    </option>
                  ))}
                </select>
                <span className="admin-field-help">
                  Controls where the boosted listing is highlighted.
                </span>
              </label>
              <label className="admin-field md:col-span-2">
                <span className="admin-field-label">Description</span>
                <input name="description" className="surface-input" />
              </label>
            </div>
          </AdminFormSection>

          <AdminFormSection
            title="Commercial setup"
            copy="Keep price, duration, sort order, and ranking weight together for quick review."
          >
            <div className="admin-form-grid sm:grid-cols-2 xl:grid-cols-5">
              <label className="admin-field">
                <span className="admin-field-label">Price</span>
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="25"
                  className="surface-input"
                  required
                />
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Currency</span>
                <input
                  name="currency"
                  maxLength={3}
                  defaultValue="AED"
                  className="surface-input uppercase"
                  required
                />
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Duration</span>
                <input
                  name="durationDays"
                  type="number"
                  min="1"
                  max="90"
                  defaultValue="7"
                  className="surface-input"
                  required
                />
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Sort</span>
                <input
                  name="sortOrder"
                  type="number"
                  min="0"
                  defaultValue="0"
                  className="surface-input"
                />
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Priority weight</span>
                <input
                  name="priorityWeight"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue="0"
                  className="surface-input"
                />
              </label>
            </div>
          </AdminFormSection>

          <AdminFormSection
            title="Availability"
            copy="Limit the package to selected categories, or leave all unselected to make it marketplace-wide."
          >
            <div className="admin-form-grid lg:grid-cols-[1fr_16rem]">
              <label className="admin-field">
                <span className="admin-field-label">Category availability</span>
                <select
                  name="categoryIds"
                  multiple
                  className="surface-input min-h-32"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentSlug ? "- " : ""}
                      {category.name}
                    </option>
                  ))}
                </select>
                <span className="admin-field-help">
                  Hold Ctrl or Cmd to choose more than one category.
                </span>
              </label>
              <div className="grid content-start gap-2">
                <label className="admin-toggle">
                  <span className="admin-toggle-copy">
                    <span>Ranking active</span>
                    <span>Apply the priority weight to search results.</span>
                  </span>
                  <input
                    name="priorityEnabled"
                    value="true"
                    type="checkbox"
                    defaultChecked
                  />
                </label>
                <label className="admin-toggle">
                  <span className="admin-toggle-copy">
                    <span>Active</span>
                    <span>Show this package to sellers.</span>
                  </span>
                  <input
                    name="isActive"
                    value="true"
                    type="checkbox"
                    defaultChecked
                  />
                </label>
              </div>
            </div>
          </AdminFormSection>

          <AdminSubmitButton pendingText="Creating package...">
            Create package
          </AdminSubmitButton>
        </form>
      </section>

      <section className="grid gap-4">
        {boostPackages.map((boostPackage) => {
          const priorityRule = packagePriorityRules.get(boostPackage.id);

          return (
            <div key={boostPackage.id} className="panel grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{boostPackage.name}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {humanizeBoostPlacement(boostPackage.placement)} /{" "}
                    {formatMoney(boostPackage.price, boostPackage.currency)} /{" "}
                    {boostPackage.durationDays} days /{" "}
                    {formatAvailability(boostPackage.categories?.length ?? 0)}
                    {" / rank weight "}
                    {priorityRule?.weight ?? 0}
                  </p>
                </div>
                <span className="rounded-md border border-[var(--line)] px-3 py-2 text-xs font-bold">
                  {boostPackage.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <form
                action={updateBoostPackageAction}
                className="admin-form-card admin-form-card-compact"
              >
                <input type="hidden" name="packageId" value={boostPackage.id} />
                <AdminFormSection title="Details" copy="Edit seller-facing label, placement, and description.">
                  <div className="admin-form-grid md:grid-cols-2">
                    <label className="admin-field">
                      <span className="admin-field-label">Name</span>
                      <input
                        name="name"
                        defaultValue={boostPackage.name}
                        className="surface-input"
                        required
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Placement</span>
                      <select
                        name="placement"
                        defaultValue={boostPackage.placement}
                        className="surface-input"
                      >
                        {boostPlacements.map((placement) => (
                          <option key={placement} value={placement}>
                            {humanizeBoostPlacement(placement)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-field md:col-span-2">
                      <span className="admin-field-label">Description</span>
                      <input
                        name="description"
                        defaultValue={boostPackage.description ?? ""}
                        className="surface-input"
                      />
                    </label>
                  </div>
                </AdminFormSection>

                <AdminFormSection title="Pricing and ranking" copy="Adjust duration, price, ordering, and search priority in one pass.">
                  <div className="admin-form-grid sm:grid-cols-2 xl:grid-cols-5">
                    <label className="admin-field">
                      <span className="admin-field-label">Price</span>
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={String(boostPackage.price)}
                        className="surface-input"
                        required
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Currency</span>
                      <input
                        name="currency"
                        maxLength={3}
                        defaultValue={boostPackage.currency}
                        className="surface-input uppercase"
                        required
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Duration</span>
                      <input
                        name="durationDays"
                        type="number"
                        min="1"
                        max="90"
                        defaultValue={boostPackage.durationDays}
                        className="surface-input"
                        required
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Sort</span>
                      <input
                        name="sortOrder"
                        type="number"
                        min="0"
                        defaultValue={boostPackage.sortOrder}
                        className="surface-input"
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Priority weight</span>
                      <input
                        name="priorityWeight"
                        type="number"
                        min="0"
                        max="10000"
                        defaultValue={priorityRule?.weight ?? 0}
                        className="surface-input"
                      />
                    </label>
                  </div>
                </AdminFormSection>

                <AdminFormSection title="Availability" copy="Set the category scope and toggle whether this package is live.">
                  <div className="admin-form-grid lg:grid-cols-[1fr_16rem]">
                    <label className="admin-field">
                      <span className="admin-field-label">Category availability</span>
                      <select
                        name="categoryIds"
                        multiple
                        defaultValue={
                          boostPackage.categories?.map((item) => item.categoryId) ??
                          []
                        }
                        className="surface-input min-h-32"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.parentSlug ? "- " : ""}
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid content-start gap-2">
                      <label className="admin-toggle">
                        <span className="admin-toggle-copy">
                          <span>Ranking active</span>
                          <span>Use this package weight in search priority.</span>
                        </span>
                        <input
                          name="priorityEnabled"
                          value="true"
                          type="checkbox"
                          defaultChecked={priorityRule?.isActive ?? false}
                        />
                      </label>
                      <label className="admin-toggle">
                        <span className="admin-toggle-copy">
                          <span>Active</span>
                          <span>Allow sellers to buy this package.</span>
                        </span>
                        <input
                          name="isActive"
                          value="true"
                          type="checkbox"
                          defaultChecked={boostPackage.isActive}
                        />
                      </label>
                    </div>
                  </div>
                </AdminFormSection>

                <AdminSubmitButton
                  className="action-secondary px-4 py-3 text-sm font-bold"
                  pendingText="Saving package..."
                >
                  Save package
                </AdminSubmitButton>
              </form>

              <form action={deleteBoostPackageAction}>
                <input type="hidden" name="packageId" value={boostPackage.id} />
                <AdminSubmitButton
                  className="rounded-md border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-700"
                  confirmMessage={`Disable "${boostPackage.name}"? Sellers will no longer be able to buy this boost package.`}
                  pendingText="Disabling package..."
                >
                  Disable package
                </AdminSubmitButton>
              </form>
            </div>
          );
        })}
      </section>
    </div>
  );
}
