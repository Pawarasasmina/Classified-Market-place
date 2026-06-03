import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createPriorityRuleAction,
  deletePriorityRuleAction,
  updatePriorityRuleAction,
} from "@/app/(main)/actions";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminBoostPackages,
  fetchAdminCategories,
  fetchAdminPriorityRules,
} from "@/lib/marketplace-api";
import type { ApiListingPriorityRuleTarget } from "@/lib/marketplace";

const priorityTargets: ApiListingPriorityRuleTarget[] = [
  "BOOSTED_LISTING",
  "BOOST_PACKAGE",
  "PAID_LISTING",
  "CATEGORY_PRIORITY",
  "SELLER_RATING",
  "MANUAL_ADMIN_PRIORITY",
  "VIP_SELLER",
  "VERIFIED_SELLER",
  "AUTHORIZED_SELLER",
];

function humanizeRuleTarget(target: ApiListingPriorityRuleTarget) {
  return target
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdminPriorityRulesPage() {
  const { accessToken, user } = await requireSessionContext(
    "/admin/priority-rules",
  );

  if (!hasAdminPermission(user.role, "LISTINGS_PRIORITY")) {
    redirect("/");
  }

  const [rules, boostPackages, categories] = await Promise.all([
    fetchAdminPriorityRules(accessToken),
    fetchAdminBoostPackages(accessToken),
    fetchAdminCategories(accessToken),
  ]);
  const activeCount = rules.filter((rule) => rule.isActive).length;

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Search priority
          </p>
          <h1 className="mt-1 text-2xl font-bold">Priority Rules</h1>
          <p className="mt-2 text-[var(--muted)]">
            Control paid listing priority, boost ranking, category weighting,
            seller rating, manual admin priority, package weights, and trusted
            seller tiers in customer results.
          </p>
        </div>
        <Link
          href="/admin"
          className="action-secondary px-4 py-2 text-sm font-semibold"
        >
          Back to admin
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Active rules", activeCount],
          ["Total rules", rules.length],
          ["Highest weight", Math.max(0, ...rules.map((rule) => rule.weight))],
          [
            "Manual admin",
            rules.find((rule) => rule.target === "MANUAL_ADMIN_PRIORITY")
              ?.weight ?? 0,
          ],
        ].map(([label, value]) => (
          <div key={label} className="admin-stat-card">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="panel grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">Create or replace a rule</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Paid listing rules apply to successful listing-fee purchases.
            Category rules apply to that category and its immediate children.
            Seller rating weight is a per-point multiplier; manual admin
            priority is the fallback score for admin-featured listings. Package
            weights are added to the active boost score.
          </p>
        </div>
        <form
          action={createPriorityRuleAction}
          className="grid gap-3 md:grid-cols-8"
        >
          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-semibold">Name</span>
            <input name="name" className="surface-input" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Target</span>
            <select name="target" className="surface-input" required>
              {priorityTargets.map((target) => (
                <option key={target} value={target}>
                  {humanizeRuleTarget(target)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Package</span>
            <select name="boostPackageId" className="surface-input">
              <option value="">General target</option>
              {boostPackages.map((boostPackage) => (
                <option key={boostPackage.id} value={boostPackage.id}>
                  {boostPackage.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Category</span>
            <select name="categoryId" className="surface-input">
              <option value="">General target</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Weight</span>
            <input
              name="weight"
              type="number"
              min="0"
              max="10000"
              defaultValue="100"
              className="surface-input"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Sort</span>
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue="0"
              className="surface-input"
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
            <input
              name="isActive"
              type="checkbox"
              value="true"
              defaultChecked
            />
            Active
          </label>
          <button className="action-primary px-4 py-2 text-sm font-semibold md:col-span-8">
            Save rule
          </button>
        </form>
      </section>

      <section className="grid gap-4">
        {rules.map((rule) => (
          <div key={rule.id} className="panel grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{rule.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {humanizeRuleTarget(rule.target)} / weight {rule.weight}
                  {rule.boostPackage ? ` / ${rule.boostPackage.name}` : ""}
                  {rule.category ? ` / ${rule.category.name}` : ""}
                </p>
              </div>
              <span className="admin-status-badge">
                {rule.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <form
              action={updatePriorityRuleAction}
              className="grid gap-3 md:grid-cols-8"
            >
              <input type="hidden" name="ruleId" value={rule.id} />
              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm font-semibold">Name</span>
                <input
                  name="name"
                  defaultValue={rule.name}
                  className="surface-input"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Target</span>
                <select
                  name="target"
                  defaultValue={rule.target}
                  className="surface-input"
                >
                  {priorityTargets.map((target) => (
                    <option key={target} value={target}>
                      {humanizeRuleTarget(target)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Package</span>
                <select
                  name="boostPackageId"
                  defaultValue={rule.boostPackageId ?? ""}
                  className="surface-input"
                >
                  <option value="">General target</option>
                  {boostPackages.map((boostPackage) => (
                    <option key={boostPackage.id} value={boostPackage.id}>
                      {boostPackage.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Category</span>
                <select
                  name="categoryId"
                  defaultValue={rule.categoryId ?? ""}
                  className="surface-input"
                >
                  <option value="">General target</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Weight</span>
                <input
                  name="weight"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue={rule.weight}
                  className="surface-input"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Sort</span>
                <input
                  name="sortOrder"
                  type="number"
                  min="0"
                  defaultValue={rule.sortOrder}
                  className="surface-input"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
                <input
                  name="isActive"
                  type="checkbox"
                  value="true"
                  defaultChecked={rule.isActive}
                />
                Active
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-8">
                <button className="action-primary px-4 py-2 text-sm font-semibold">
                  Update
                </button>
              </div>
            </form>
            <form action={deletePriorityRuleAction}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <button className="admin-table-action">Deactivate</button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
