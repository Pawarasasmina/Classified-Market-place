import Link from "next/link";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { fetchCategories } from "@/lib/marketplace-api";

export default async function CategoriesPage() {
  const categories = await fetchCategories();

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Category schema system
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Categories and dynamic form definitions from the live marketplace API.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          The web app now loads the active category catalog from the backend,
          including the schema payload used to drive listing creation.
        </p>
      </div>

      <div className="grid gap-6">
        {categories.map((category) => (
          <section
            key={category.slug}
            className="rounded-[2rem] border border-[var(--line)] p-6"
            style={{ background: category.accent }}
          >
            <div className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.82)] text-[var(--brand-deep)]">
                  <CategoryIcon slug={category.slug} className="h-7 w-7" />
                </div>
                <h2 className="display-font mt-5 text-3xl font-bold text-[var(--foreground)]">
                  {category.name}
                </h2>
                <p className="mt-3 text-base leading-7 text-[var(--muted)]">
                  {category.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)]">
                    {category.countLabel}
                  </span>
                  <Link
                    href={`/search?category=${category.slug}`}
                    className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  >
                    Browse listings
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.75rem] border border-[var(--line)] bg-white p-5">
                  <p className="display-font text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-deep)]">
                    Schema fields
                  </p>
                  <div className="mt-4 space-y-3">
                    {category.schema.length ? (
                      category.schema.map((field) => (
                        <div
                          key={field.key}
                          className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3"
                        >
                          <p className="font-semibold text-[var(--foreground)]">
                            {field.label}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {field.type}
                            {field.required ? " - required" : " - optional"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                        This category does not currently expose dynamic fields.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-[var(--line)] bg-white p-5">
                  <p className="display-font text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-deep)]">
                    API-backed notes
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3">
                      <p className="font-semibold text-[var(--foreground)]">Slug</p>
                      <p className="text-sm text-[var(--muted)]">{category.slug}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3">
                      <p className="font-semibold text-[var(--foreground)]">
                        Listing status
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {category.countLabel}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                      Child browse nodes are not exposed by the current backend yet,
                      so this route focuses on the live category catalog and schema
                      payload used by listing creation.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
