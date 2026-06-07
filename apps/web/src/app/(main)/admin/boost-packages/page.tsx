import { redirect } from "next/navigation";
import {
  createBoostPackageAction,
  deleteBoostPackageAction,
  updateBoostPackageAction,
} from "@/app/(main)/actions";
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

function formatMoney(price: string | number, currency: string) {
  const amount = Number(price);

  return `${currency} ${Number.isNaN(amount) ? price : amount.toLocaleString()}`;
}

function formatAvailability(categoryCount: number) {
  return categoryCount > 0
    ? `${categoryCount} ${categoryCount === 1 ? "category" : "categories"}`
    : "All categories";
}

export default async function AdminBoostPackagesPage() {
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
      <section className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Boost revenue setup
          </p>
          <h1 className="mt-1 text-2xl font-bold">Boost Packages</h1>
          <p className="mt-2 max-w-3xl text-[var(--muted)]">
            Configure the packages sellers can buy, including placement, price,
            duration, visibility, and their ranking weight in customer results.
          </p>
        </div>
        <div className="rounded-md bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold">
          {activeCount} active / {boostPackages.length} total
        </div>
      </section>

      <section className="panel">
        <h2 className="text-xl font-bold">Create package</h2>
        <form
          action={createBoostPackageAction}
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-8"
        >
          <label className="grid gap-2 text-sm font-semibold">
            Name
            <input name="name" className="surface-input" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Placement
            <select name="placement" className="surface-input">
              {boostPlacements.map((placement) => (
                <option key={placement} value={placement}>
                  {humanizeBoostPlacement(placement)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Price
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
          <label className="grid gap-2 text-sm font-semibold">
            Currency
            <input
              name="currency"
              maxLength={3}
              defaultValue="AED"
              className="surface-input uppercase"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Duration
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
          <label className="grid gap-2 text-sm font-semibold">
            Sort
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue="0"
              className="surface-input"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Priority weight
            <input
              name="priorityWeight"
              type="number"
              min="0"
              max="10000"
              defaultValue="0"
              className="surface-input"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              name="priorityEnabled"
              value="true"
              type="checkbox"
              defaultChecked
            />
            Ranking active
          </label>
          <label className="grid gap-2 text-sm font-semibold md:col-span-2 xl:col-span-7">
            Description
            <input name="description" className="surface-input" />
          </label>
          <label className="grid gap-2 text-sm font-semibold md:col-span-2 xl:col-span-7">
            Category availability
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
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              name="isActive"
              value="true"
              type="checkbox"
              defaultChecked
            />
            Active
          </label>
          <button className="action-primary px-4 py-3 text-sm font-bold md:col-span-2 xl:col-span-8">
            Create package
          </button>
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
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-8"
              >
                <input type="hidden" name="packageId" value={boostPackage.id} />
                <label className="grid gap-2 text-sm font-semibold">
                  Name
                  <input
                    name="name"
                    defaultValue={boostPackage.name}
                    className="surface-input"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Placement
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
                <label className="grid gap-2 text-sm font-semibold">
                  Price
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
                <label className="grid gap-2 text-sm font-semibold">
                  Currency
                  <input
                    name="currency"
                    maxLength={3}
                    defaultValue={boostPackage.currency}
                    className="surface-input uppercase"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Duration
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
                <label className="grid gap-2 text-sm font-semibold">
                  Sort
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    defaultValue={boostPackage.sortOrder}
                    className="surface-input"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Priority weight
                  <input
                    name="priorityWeight"
                    type="number"
                    min="0"
                    max="10000"
                    defaultValue={priorityRule?.weight ?? 0}
                    className="surface-input"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    name="priorityEnabled"
                    value="true"
                    type="checkbox"
                    defaultChecked={priorityRule?.isActive ?? false}
                  />
                  Ranking active
                </label>
                <label className="grid gap-2 text-sm font-semibold md:col-span-2 xl:col-span-7">
                  Description
                  <input
                    name="description"
                    defaultValue={boostPackage.description ?? ""}
                    className="surface-input"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold md:col-span-2 xl:col-span-7">
                  Category availability
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
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    name="isActive"
                    value="true"
                    type="checkbox"
                    defaultChecked={boostPackage.isActive}
                  />
                  Active
                </label>
                <button className="action-secondary px-4 py-3 text-sm font-bold md:col-span-2 xl:col-span-3">
                  Save package
                </button>
              </form>

              <form action={deleteBoostPackageAction}>
                <input type="hidden" name="packageId" value={boostPackage.id} />
                <button className="rounded-md border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-700">
                  Disable package
                </button>
              </form>
            </div>
          );
        })}
      </section>
    </div>
  );
}
