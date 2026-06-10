import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminActionFeedback } from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { CategoryManagement } from "@/components/marketplace/category-management";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminCategories } from "@/lib/marketplace-api";

type AdminCategoriesPageProps = {
  searchParams: Promise<{
    category?: string;
    message?: string;
  }>;
};

export default async function AdminCategoriesPage(
  props: AdminCategoriesPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext("/admin/categories");

  if (!hasAdminPermission(user.role, "CATEGORIES_READ")) {
    redirect("/");
  }

  const canEditCategories = hasAdminPermission(user.role, "CATEGORIES_WRITE");
  const categories = await fetchAdminCategories(accessToken);

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Admin workspace"
        title="Category Management"
        description="Manage categories, subcategories, and deeper category levels."
        badge={`${categories.length} categories`}
        actions={
          <Link href="/admin" className="action-secondary px-4 py-2 text-sm font-semibold">
            Back to admin
          </Link>
        }
      />

      <AdminActionFeedback
        status={searchParams.category}
        message={searchParams.message}
        messages={{
          updated: "Category updated.",
          deleted: "Category disabled.",
          invalid: "Choose a category before submitting.",
        }}
        successStatuses={["updated", "deleted"]}
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/categories/main"
          className="action-secondary px-4 py-2 text-sm font-semibold"
        >
          Main categories
        </Link>
        <Link
          href="/admin/categories/subcategories"
          className="action-secondary px-4 py-2 text-sm font-semibold"
        >
          Subcategories
        </Link>
      </div>

      <CategoryManagement
        categories={categories}
        canEdit={canEditCategories}
      />
    </div>
  );
}
