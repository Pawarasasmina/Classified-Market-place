import Link from "next/link";
import { SaveSearchButton } from "@/components/marketplace/save-search-button";
import { getSessionContext } from "@/lib/auth-dal";
import { ListingCard } from "@/components/marketplace/listing-card";
import { fetchCategories, fetchListings, fetchSavedSearches } from "@/lib/marketplace-api";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    location?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: string;
  }>;
};

function normalizeSort(sort: string | undefined) {
  if (sort === "price-asc" || sort === "price_asc") {
    return "price_asc" as const;
  }

  if (sort === "price-desc" || sort === "price_desc") {
    return "price_desc" as const;
  }

  return "newest" as const;
}

function buildSearchHref(params: {
  q?: string;
  category?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.category) {
    searchParams.set("category", params.category);
  }

  if (params.sort && params.sort !== "newest") {
    searchParams.set("sort", params.sort);
  }

  if (params.location) {
    searchParams.set("location", params.location);
  }

  if (params.minPrice) {
    searchParams.set("minPrice", params.minPrice);
  }

  if (params.maxPrice) {
    searchParams.set("maxPrice", params.maxPrice);
  }

  if (params.page && params.page !== "1") {
    searchParams.set("page", params.page);
  }

  const queryString = searchParams.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

export default async function SearchPage(props: SearchPageProps) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "";
  const location = searchParams.location ?? "";
  const minPrice = searchParams.minPrice ?? "";
  const maxPrice = searchParams.maxPrice ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const sort = normalizeSort(searchParams.sort);
  const currentPath = buildSearchHref({
    q: q || undefined,
    category: category || undefined,
    sort,
    location: location || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    page: String(page),
  });
  const session = await getSessionContext();

  const [categories, listingResults, savedSearches] = await Promise.all([
    fetchCategories(),
    fetchListings({
      search: q || undefined,
      categorySlug: category || undefined,
      location: location || undefined,
      sort,
      page,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    }),
    session?.accessToken ? fetchSavedSearches(session.accessToken) : Promise.resolve([]),
  ]);
  const filtered = listingResults.items;
  const pagination = listingResults.pagination;
  const matchingSavedSearch =
    savedSearches.find(
      (savedSearch) =>
        savedSearch.query === q.trim() &&
        savedSearch.categorySlug === category &&
        savedSearch.sort === sort
    ) ?? null;
  const canSaveSearch = Boolean(q.trim() || category || sort !== "newest");

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 grid gap-6 xl:grid-cols-[0.74fr_0.26fr]">
        <div className="rounded-[2.25rem] border border-[var(--line)] bg-[rgba(32,39,85,0.9)] p-6">
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Search API
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
            Browse live listings with real category filters and backend sorting.
          </h1>
          <p className="mt-4 text-base leading-8 text-[var(--muted)]">
            Results now come directly from the listings endpoint, including
            category filtering, keyword search, and server-side sort order.
          </p>
        </div>

        <div className="rounded-[2.25rem] border border-[var(--line)] bg-[rgba(32,39,85,0.9)] p-6">
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Result summary
          </p>
          <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
            {pagination.totalItems}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            matching listings across {pagination.totalPages} page
            {pagination.totalPages === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.24fr_0.76fr]">
        <aside className="space-y-5 rounded-[2rem] border border-[var(--line)] bg-[rgba(32,39,85,0.9)] p-5">
          <form action="/search" className="space-y-4 rounded-[1.5rem] border border-[var(--line)] bg-[rgba(9,12,26,0.55)] p-4">
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="sort" value={sort} />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Keyword
              </p>
              <input
                name="q"
                defaultValue={q}
                placeholder="Marina apartment, Camry, iPhone..."
                className="mt-2 w-full rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Location
              </p>
              <input
                name="location"
                defaultValue={location}
                placeholder="Dubai Marina"
                className="mt-2 w-full rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Min price
                </p>
                <input
                  name="minPrice"
                  inputMode="numeric"
                  defaultValue={minPrice}
                  placeholder="1000"
                  className="mt-2 w-full rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Max price
                </p>
                <input
                  name="maxPrice"
                  inputMode="numeric"
                  defaultValue={maxPrice}
                  placeholder="5000"
                  className="mt-2 w-full rounded-[1rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
              >
                Apply filters
              </button>
              <Link
                href="/search"
                className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)]"
              >
                Reset search
              </Link>
            </div>
          </form>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Category
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/search"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  category === ""
                    ? "bg-[var(--brand)] text-[var(--foreground)]"
                    : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                }`}
              >
                All
              </Link>
              {categories.map((item) => (
                <Link
                  key={item.slug}
                  href={buildSearchHref({
                    q: q || undefined,
                    category: item.slug,
                    sort,
                    location: location || undefined,
                    minPrice: minPrice || undefined,
                    maxPrice: maxPrice || undefined,
                  })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    category === item.slug
                      ? "bg-[var(--brand)] text-[var(--foreground)]"
                      : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Sort
            </p>
            <div className="mt-3 grid gap-2">
              {[
                ["newest", "Newest"],
                ["price_asc", "Price low to high"],
                ["price_desc", "Price high to low"],
              ].map(([value, label]) => (
                <Link
                  key={value}
                  href={buildSearchHref({
                    q: q || undefined,
                    category: category || undefined,
                    sort: value as "newest" | "price_asc" | "price_desc",
                    location: location || undefined,
                    minPrice: minPrice || undefined,
                    maxPrice: maxPrice || undefined,
                  })}
                  className={`rounded-[1.25rem] px-4 py-3 text-sm font-semibold ${
                    sort === value
                      ? "bg-[var(--brand)] text-[var(--foreground)]"
                      : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(9,12,26,0.55)] p-4 text-sm leading-7 text-[var(--muted)]">
            {session ? (
              <>
                <p className="font-semibold text-[var(--foreground)]">
                  Save the current filters
                </p>
                <p className="mt-2">
                  Persist this keyword, category, and sort combination so it shows
                  up on your saved page with alert preferences.
                </p>
                <div className="mt-4">
                  <SaveSearchButton
                    query={q.trim()}
                    categorySlug={category}
                    sort={sort}
                    currentPath={currentPath}
                    initialSavedSearch={matchingSavedSearch}
                    disabled={!canSaveSearch}
                  />
                </div>
                {!canSaveSearch ? (
                  <p className="mt-3 text-xs">
                    Add a keyword, category, or non-default sort before saving.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                Save searches after you sign in to keep filters and alert
                preferences synced to your account.
                <div className="mt-4">
                  <Link
                    href={`/login?next=${encodeURIComponent(currentPath)}`}
                    className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  >
                    Sign in to save searches
                  </Link>
                </div>
              </>
            )}
          </div>
        </aside>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(32,39,85,0.9)] p-5">
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--muted)]">
                Query: {q || "none"}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--muted)]">
                Category: {category || "all"}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--muted)]">
                Location: {location || "any"}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--muted)]">
                Price: {minPrice || "0"} to {maxPrice || "any"}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--muted)]">
                Sort: {sort}
              </span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.length ? (
              filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} compact />
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3 rounded-[2rem] border border-dashed border-[var(--line)] bg-[rgba(32,39,85,0.7)] px-6 py-10 text-sm text-[var(--muted)]">
                No listings matched this search. Try another keyword or reset the
                category filter.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[var(--line)] bg-[rgba(32,39,85,0.9)] p-5">
            <p className="text-sm text-[var(--muted)]">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-3">
              <Link
                href={buildSearchHref({
                  q: q || undefined,
                  category: category || undefined,
                  sort,
                  location: location || undefined,
                  minPrice: minPrice || undefined,
                  maxPrice: maxPrice || undefined,
                  page: String(Math.max(1, pagination.page - 1)),
                })}
                aria-disabled={!pagination.hasPreviousPage}
                className={`rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold ${
                  pagination.hasPreviousPage
                    ? "bg-[var(--surface-strong)] text-[var(--foreground)]"
                    : "cursor-not-allowed bg-[rgba(17,24,45,0.6)] text-[var(--muted)] pointer-events-none"
                }`}
              >
                Previous
              </Link>
              <Link
                href={buildSearchHref({
                  q: q || undefined,
                  category: category || undefined,
                  sort,
                  location: location || undefined,
                  minPrice: minPrice || undefined,
                  maxPrice: maxPrice || undefined,
                  page: String(pagination.page + 1),
                })}
                aria-disabled={!pagination.hasNextPage}
                className={`rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold ${
                  pagination.hasNextPage
                    ? "bg-[var(--surface-strong)] text-[var(--foreground)]"
                    : "cursor-not-allowed bg-[rgba(17,24,45,0.6)] text-[var(--muted)] pointer-events-none"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
