import { ListingCard } from "@/components/marketplace/listing-card";
import { fetchCategories, fetchListings } from "@/lib/marketplace-api";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    location?: string;
    minPrice?: string;
    maxPrice?: string;
    view?: string;
  }>;
};

function normalizeSort(sort: string | undefined) {
  if (sort === "price_asc") return "price_asc" as const;
  if (sort === "price_desc") return "price_desc" as const;
  return "newest" as const;
}

function numberParam(value: string | undefined) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function buildSearchHref(params: {
  q?: string;
  category?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  view?: string;
}) {
  const next = new URLSearchParams();

  if (params.q) next.set("q", params.q);
  if (params.category) next.set("category", params.category);
  if (params.location) next.set("location", params.location);
  if (params.minPrice) next.set("minPrice", params.minPrice);
  if (params.maxPrice) next.set("maxPrice", params.maxPrice);
  if (params.sort && params.sort !== "newest") next.set("sort", params.sort);
  if (params.view) next.set("view", params.view);

  const query = next.toString();
  return query ? `/search?${query}` : "/search";
}

export default async function SearchPage(props: SearchPageProps) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "";
  const location = searchParams.location ?? "";
  const minPrice = searchParams.minPrice ?? "";
  const maxPrice = searchParams.maxPrice ?? "";
  const sort = normalizeSort(searchParams.sort);
  const customerPreview = searchParams.view === "customer";
  const view = customerPreview ? "customer" : undefined;
  const [categories, listings] = await Promise.all([
    fetchCategories(),
    fetchListings({
      search: q || undefined,
      categorySlug: category || undefined,
      location: location || undefined,
      minPrice: numberParam(searchParams.minPrice),
      maxPrice: numberParam(searchParams.maxPrice),
      sort,
    }),
  ]);
  const selectedCategory = categories.find((item) => item.slug === category);

  return (
    <div className="page grid gap-7">
      <section className="grid gap-5 xl:grid-cols-[1fr_19rem]">
        <div className="hero-panel p-6">
          <p className="section-eyebrow">Search API</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-white sm:text-4xl">
            Browse live listings with real category filters and backend sorting.
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--muted)]">
              Filter by keyword, category, location, and price. Results stay focused
              on active customer-facing inventory.
          </p>
        </div>
        <aside className="hero-panel p-6">
          <p className="section-eyebrow">Result summary</p>
          <p className="mt-4 text-5xl font-black text-white">{listings.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            matching listings across the current page
          </p>
        </aside>
      </section>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="filter-panel h-fit">
          <form className="grid gap-4">
            {customerPreview ? <input type="hidden" name="view" value="customer" /> : null}
            <label className="grid gap-2">
              <span>Keyword</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Toyota, apartment, iPhone..."
                className="surface-input text-sm"
              />
            </label>
            <label className="grid gap-2">
              <span>Category</span>
              <select name="category" defaultValue={category} className="surface-input text-sm">
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.parentSlug ? "- " : ""}
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span>Location</span>
              <input
                name="location"
                defaultValue={location}
                placeholder="Dubai"
                className="surface-input text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <label className="grid gap-2">
                <span>Min price</span>
                <input
                  name="minPrice"
                  defaultValue={minPrice}
                  inputMode="numeric"
                  className="surface-input text-sm"
                  placeholder="0"
                />
              </label>
              <label className="grid gap-2">
                <span>Max price</span>
                <input
                  name="maxPrice"
                  defaultValue={maxPrice}
                  inputMode="numeric"
                  className="surface-input text-sm"
                  placeholder="Any"
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span>Sort</span>
              <select name="sort" defaultValue={sort} className="surface-input text-sm">
                <option value="newest">Newest</option>
                <option value="price_asc">Price low to high</option>
                <option value="price_desc">Price high to low</option>
              </select>
            </label>
            <button className="action-primary px-4 py-3 text-sm font-bold">
              Apply filters
            </button>
          </form>

          <div className="mt-5 border-t border-[var(--line)] pt-5">
            <p className="field-label">Quick categories</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={buildSearchHref({ q, sort, location, minPrice, maxPrice, view })}
                className={`rounded-full px-3 py-2 text-xs font-bold ${
                  category
                    ? "border border-[var(--line)] text-[var(--muted)]"
                    : "bg-[var(--brand)] text-white"
                }`}
              >
                All
              </a>
              {categories.slice(0, 8).map((item) => (
                <a
                  key={item.slug}
                  href={buildSearchHref({
                    q,
                    category: item.slug,
                    sort,
                    location,
                    minPrice,
                    maxPrice,
                    view,
                  })}
                  className={`rounded-full px-3 py-2 text-xs font-bold ${
                    category === item.slug
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--line)] text-[var(--muted)]"
                  }`}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="grid gap-5">
          <div className="hero-panel flex flex-wrap items-center gap-2 p-4 text-sm">
            <span className="search-chip">
              Query: {q || "any"}
            </span>
            <span className="search-chip">
              Category: {selectedCategory?.name ?? "all"}
            </span>
            <span className="search-chip">
              Location: {location || "any"}
            </span>
            <span className="search-chip">
              Sort: {sort.replace("_", " ")}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.length ? (
              listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  compact
                  customerView={customerPreview}
                />
              ))
            ) : (
              <div className="panel md:col-span-2 xl:col-span-3">
                <h2 className="text-xl font-black">No listings matched.</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Try a broader keyword, remove price filters, or browse all categories.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
