import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminActionFeedback } from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { CategoryManagement } from "@/components/marketplace/category-management";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminCategories } from "@/lib/marketplace-api";

type AdminMainCategoriesPageProps = {
  searchParams: Promise<{
    category?: string;
    message?: string;
  }>;
};

export default async function AdminMainCategoriesPage(
  props: AdminMainCategoriesPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/categories/main",
  );

  if (!hasAdminPermission(user.role, "CATEGORIES_READ")) {
    redirect("/");
  }

  const canEditCategories = hasAdminPermission(user.role, "CATEGORIES_WRITE");
  const categories = await fetchAdminCategories(accessToken);

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Admin workspace"
        title="Main Categories"
        description="Focus on top-level category groups and their inherited question sets."
        badge={`${categories.filter((category) => !category.parentSlug).length} main`}
        actions={
          <Link
            href="/admin/categories"
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            All categories
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

      <CategoryManagement
        categories={categories}
        canEdit={canEditCategories}
        returnTo="/admin/categories/main"
        initialTypeFilter="main"
        initialCreateMode="main"
      />
    </div>
  );
}
