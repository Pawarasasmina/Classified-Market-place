import { requireAdminSession } from "@/lib/auth-dal";
import { fetchCategories } from "@/lib/marketplace-api";
import { AdminPageHeader, AdminPanel } from "@/components/marketplace/admin-ui";

export default async function AdminCategoriesPage() {
  await requireAdminSession("/admin/categories");
  const categories = await fetchCategories();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Category Management"
        title="Manage category tree and dynamic schema definitions."
        description="Create and update parent/sub categories, enable or disable categories, and maintain schema_definition JSON with validation-ready field rules."
      />

      <AdminPanel title="Category tree view">
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.id} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{category.name}</p>
                  <p className="text-sm text-[var(--muted)]">Slug: {category.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Edit</button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Enable/Disable</button>
                  <button className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">Delete</button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {category.schema.map((field) => (
                  <span key={field.key} className="rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-1 text-xs text-[var(--muted)]">
                    {field.label} ({field.type})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Schema builder">
        <p className="text-sm text-[var(--muted)]">
          Field types supported: text, number, dropdown, boolean, date, range.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" placeholder="Field key" />
          <input className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none" placeholder="Field label" />
          <select className="rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none">
            <option>text</option>
            <option>number</option>
            <option>dropdown</option>
            <option>boolean</option>
            <option>date</option>
            <option>range</option>
          </select>
        </div>
        <button className="mt-3 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          Save schema_definition JSON
        </button>
      </AdminPanel>
    </div>
  );
}
