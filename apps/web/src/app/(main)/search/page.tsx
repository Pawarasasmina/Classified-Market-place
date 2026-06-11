import { ListingCard } from "@/components/marketplace/listing-card";
import {
  buildMarketplaceCategoryTree,
  flattenMarketplaceCategoryTree,
} from "@/lib/category-tree";
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
  if (sort === "newest") return "newest" as const;
  if (sort === "price_asc") return "price_asc" as const;
  if (sort === "price_desc") return "price_desc" as const;
  return "recommended" as const;
}

function numberParam(value: string | undefined) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function buildSearchHref(params: {
  q?: string;
  category?: string;
  sort?: "recommended" | "newest" | "price_asc" | "price_desc";
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
  if (params.sort && params.sort !== "recommended")
    next.set("sort", params.sort);
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
  const listingQuery = {
    search: q || undefined,
    categorySlug: category || undefined,
    location: location || undefined,
    minPrice: numberParam(searchParams.minPrice),
    maxPrice: numberParam(searchParams.maxPrice),
    sort,
  };
  const [categories, matchingListings] = await Promise.all([
    fetchCategories(),
    fetchListings(listingQuery),
  ]);
  const categoryTree = buildMarketplaceCategoryTree(categories);
  const flatCategories = flattenMarketplaceCategoryTree(categoryTree);
  const selectedCategory = categories.find((item) => item.slug === category);
  const relatedListings =
    matchingListings.length || !selectedCategory
      ? []
      : await fetchListings({
          ...listingQuery,
          categorySlug: selectedCategory.parentSlug ?? undefined,
          take: 12,
        });
  const listings = matchingListings.length ? matchingListings : relatedListings;
  const isShowingRelatedListings =
    matchingListings.length === 0 && relatedListings.length > 0;
  const relatedScopeLabel = selectedCategory?.parentSlug
    ? "the broader category"
    : "recent marketplace listings";
  const activeFilters = [
    q ? `Keyword: ${q}` : null,
    selectedCategory?.name ? `Category: ${selectedCategory.name}` : null,
    location ? `Location: ${location}` : null,
    minPrice ? `Min: ${minPrice}` : null,
    maxPrice ? `Max: ${maxPrice}` : null,
    sort !== "recommended" ? `Sort: ${sort.replaceAll("_", " ")}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="page search-page-layout grid gap-5">
      <section className="panel search-results-head">
        <div className="search-results-head-copy">
          <h1 className="search-results-title">
            {selectedCategory?.name ?? "All listings"}
          </h1>
          <p className="search-results-meta">
            {isShowingRelatedListings
              ? `0 exact matches - showing ${relatedListings.length} related listing${
                  relatedListings.length === 1 ? "" : "s"
                }`
              : `${matchingListings.length} matching listing${
                  matchingListings.length === 1 ? "" : "s"
                }`}
          </p>
        </div>
        {activeFilters.length ? (
          <div className="search-chip-row">
            {activeFilters.map((label) => (
              <span key={label} className="search-chip">
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <aside className="filter-panel h-fit">
          <form className="grid gap-3.5">
            <div className="search-filter-head">
              <div>
                <p className="section-eyebrow">Filters</p>
                <h2 className="mt-1.5 text-base font-black text-white">
                  Refine results
                </h2>
              </div>
              <a
                href={buildSearchHref({ view })}
                className="search-reset-link"
              >
                Reset
              </a>
            </div>
            {customerPreview ? (
              <input type="hidden" name="view" value="customer" />
            ) : null}
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
              <select
                name="category"
                defaultValue={category}
                className="surface-input text-sm"
              >
                <option value="">All categories</option>
                {flatCategories.map(({ category: item, depth }) => (
                  <option key={item.slug} value={item.slug}>
                    {"- ".repeat(depth)}
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
              <select
                name="sort"
                defaultValue={sort}
                className="surface-input text-sm"
              >
                <option value="recommended">Recommended</option>
                <option value="newest">Newest first</option>
                <option value="price_asc">Price low to high</option>
                <option value="price_desc">Price high to low</option>
              </select>
            </label>
            <button className="action-primary px-4 py-2.5 text-sm font-bold">
              Apply filters
            </button>
          </form>

          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <p className="field-label">Quick categories</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={buildSearchHref({
                  q,
                  sort,
                  location,
                  minPrice,
                  maxPrice,
                  view,
                })}
                className={`rounded-full px-3 py-2 text-xs font-bold ${
                  category
                    ? "border border-[var(--line)] text-[var(--muted)]"
                    : "bg-[var(--brand)] text-white"
                }`}
              >
                All
              </a>
              {flatCategories.slice(0, 10).map(({ category: item, depth }) => (
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
                  {depth ? "- " : ""}
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="grid gap-5">
          {isShowingRelatedListings ? (
            <div className="panel">
              <h2 className="text-lg font-black">Showing related listings</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                No active listings are assigned directly to{" "}
                {selectedCategory?.name}. These items come from{" "}
                {relatedScopeLabel} so the page does not feel empty.
              </p>
            </div>
          ) : null}
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
                  Try a broader keyword, remove price filters, or browse all
                  categories.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
