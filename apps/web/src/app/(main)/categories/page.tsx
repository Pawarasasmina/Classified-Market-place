import Link from "next/link";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { fetchCategories } from "@/lib/marketplace-api";

type CategoriesPageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

function previewHref(path: string, customerPreview: boolean) {
  if (!customerPreview) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}view=customer`;
}

export default async function CategoriesPage(props: CategoriesPageProps) {
  const searchParams = await props.searchParams;
  const customerPreview = searchParams.view === "customer";
  const categories = await fetchCategories();
  const topLevel = categories.filter((category) => !category.parentSlug);
  const childCategories = categories.filter((category) => category.parentSlug);
  const showcaseCategories = childCategories.length ? childCategories : categories;

  return (
    <div className="page grid gap-10">
      <div className="hero-panel p-6 sm:p-8">
        <p className="section-eyebrow">Category schemas system</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight text-white sm:text-4xl">
              Categories and dynamic form definitions from the live marketplace API.
            </h1>
            <p className="mt-5 max-w-4xl text-base leading-8 text-[var(--muted)]">
              The web app loads the active category catalog from the backend, including
              schema payloads that drive listing creation.
            </p>
          </div>
          <Link
            href={previewHref("/search", customerPreview)}
            className="action-primary px-4 py-3 text-sm font-bold"
          >
            Browse all listings
          </Link>
        </div>
      </div>

      <section className="marketplace-section">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Main sections</p>
            <h2 className="mt-2 text-3xl font-black text-white">
              Start with the places people search most.
            </h2>
          </div>
          <p className="text-sm font-semibold text-[var(--muted)]">
            {topLevel.length} parent categories
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {topLevel.map((category) => (
            <Link
              key={category.slug}
              href={previewHref(`/search?category=${category.slug}`, customerPreview)}
              className="category-tile group grid content-between transition"
              style={{ background: category.accent }}
            >
              <div>
                <div className="category-icon-badge">
                  <CategoryIcon slug={category.slug} className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-black">{category.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#4f566d]">
                  {category.description}
                </p>
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#11182d]">
                {category.countLabel}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="marketplace-section">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">API-backed nodes</p>
            <h2 className="mt-2 text-3xl font-black text-white">
              Category cards with schema fields beside them.
            </h2>
          </div>
          <p className="text-sm font-semibold text-[var(--muted)]">
            {showcaseCategories.length} active browse nodes
          </p>
        </div>

        <div className="grid gap-6">
          {showcaseCategories.map((category) => (
            <section
              key={category.slug}
              className="schema-showcase grid gap-5 p-5 lg:grid-cols-[1.1fr_0.85fr_0.85fr]"
            >
              <div className="p-1 sm:p-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[var(--brand)] shadow-sm">
                  <CategoryIcon slug={category.slug} className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-3xl font-black">{category.name}</h3>
                <p className="mt-3 max-w-md text-sm leading-7 text-[#4f566d]">
                  {category.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#11182d] px-4 py-2 text-sm font-black text-white">
                    {category.countLabel}
                  </span>
                  <Link
                    href={previewHref(`/search?category=${category.slug}`, customerPreview)}
                    className="rounded-full bg-[#11182d] px-4 py-2 text-sm font-black text-white"
                  >
                    Browse listings
                  </Link>
                </div>
              </div>

              <div className="schema-panel">
                <p className="section-eyebrow">Schema fields</p>
                <div className="mt-4 grid gap-3">
                  {(category.schema.length ? category.schema : []).map((field) => (
                    <div key={field.key} className="schema-field">
                      <p className="font-black">{field.label}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {field.type} - {field.required ? "required" : "optional"}
                      </p>
                    </div>
                  ))}
                  {!category.schema.length ? (
                    <div className="schema-field">
                      <p className="font-black">General listing fields</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        title, price, description, location
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="schema-panel">
                <p className="section-eyebrow">API-backed notes</p>
                <div className="mt-4 grid gap-3">
                  <div className="schema-field">
                    <p className="font-black">Slug</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{category.slug}</p>
                  </div>
                  <div className="schema-field">
                    <p className="font-black">Listing status</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{category.countLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.18)] p-4 text-sm leading-7 text-[var(--muted)]">
                    Child browse nodes and schema payloads are loaded from the backend,
                    so category pages stay aligned with listing creation.
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
