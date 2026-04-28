import Link from "next/link";
import { categories } from "@/lib/phase1-data";

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Category schema system
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Categories and dynamic form definitions for the Phase 1 marketplace.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          The delivery plan calls for a seed category tree, schema-driven forms,
          and APIs that let web and mobile render listing inputs dynamically.
          This page mirrors that setup with Phase 1 categories and sample field
          definitions.
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.82)] text-xl font-bold text-[var(--brand-deep)]">
                  {category.icon}
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
                    {category.schema.map((field) => (
                      <div
                        key={field.key}
                        className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3"
                      >
                        <p className="font-semibold text-[var(--foreground)]">
                          {field.label}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {field.type}
                          {field.required ? " • required" : " • optional"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-[var(--line)] bg-white p-5">
                  <p className="display-font text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-deep)]">
                    Child browse nodes
                  </p>
                  <div className="mt-4 space-y-3">
                    {category.children?.length ? (
                      category.children.map((child) => (
                        <div
                          key={child.id}
                          className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3"
                        >
                          <p className="font-semibold text-[var(--foreground)]">
                            {child.name}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {child.description}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                        Child nodes can be seeded later through admin category
                        management and the schema API.
                      </div>
                    )}
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
