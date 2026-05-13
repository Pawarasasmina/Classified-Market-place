import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryManagement } from "@/components/marketplace/category-management";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminCategories } from "@/lib/marketplace-api";

export default async function AdminCategoriesPage() {
  const { accessToken, user } = await requireSessionContext("/admin/categories");

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const categories = await fetchAdminCategories(accessToken);

  return (
    <div className="page grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
            Admin dashboard
          </p>
          <h1 className="mt-1 text-2xl font-bold">Category Management</h1>
          <p className="mt-2 text-[var(--muted)]">
            Manage categories, subcategories, and deeper category levels.
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
        >
          Back to admin
        </Link>
      </div>

      <CategoryManagement categories={categories} />
    </div>
  );
}
