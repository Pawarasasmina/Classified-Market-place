import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryManagement } from "@/components/marketplace/category-management";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminCategories } from "@/lib/marketplace-api";

export default async function AdminSubcategoriesPage() {
  const { accessToken, user } = await requireSessionContext(
    "/admin/categories/subcategories",
  );

  if (!hasAdminPermission(user.role, "CATEGORIES_READ")) {
    redirect("/");
  }

  const canEditCategories = hasAdminPermission(user.role, "CATEGORIES_WRITE");
  const categories = await fetchAdminCategories(accessToken);

  return (
    <div className="page grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Admin dashboard
          </p>
          <h1 className="mt-1 text-2xl font-bold">Subcategories</h1>
          <p className="mt-2 text-[var(--muted)]">
            Review inherited category questions, child-only overrides, and branch
            structure in one place.
          </p>
        </div>
        <Link
          href="/admin/categories"
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
        >
          All categories
        </Link>
      </div>

      <CategoryManagement
        categories={categories}
        canEdit={canEditCategories}
        returnTo="/admin/categories/subcategories"
        initialTypeFilter="sub"
        initialCreateMode="sub"
      />
    </div>
  );
}
