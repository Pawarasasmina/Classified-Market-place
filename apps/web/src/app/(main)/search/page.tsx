import Link from "next/link";
import { ListingCard } from "@/components/marketplace/listing-card";
import { fetchCategories, fetchListings } from "@/lib/marketplace-api";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
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

export default async function SearchPage(props: SearchPageProps) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "";
  const sort = normalizeSort(searchParams.sort);

  const [categories, filtered] = await Promise.all([
    fetchCategories(),
    fetchListings({
      search: q || undefined,
      categorySlug: category || undefined,
      sort,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 grid gap-6 xl:grid-cols-[0.74fr_0.26fr]">
        <div className="rounded-[2.25rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
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

        <div className="rounded-[2.25rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Result summary
          </p>
          <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
            {filtered.length}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            active listings match your current filters
          </p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.24fr_0.76fr]">
        <aside className="space-y-5 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Category
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/search"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  category === ""
                    ? "bg-[var(--foreground)] text-[var(--surface)]"
                    : "border border-[var(--line)] bg-white text-[var(--foreground)]"
                }`}
              >
                All
              </Link>
              {categories.map((item) => (
                <Link
                  key={item.slug}
                  href={`/search?category=${item.slug}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    category === item.slug
                      ? "bg-[var(--foreground)] text-[var(--surface)]"
                      : "border border-[var(--line)] bg-white text-[var(--foreground)]"
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
                  href={`/search${category ? `?category=${category}&sort=${value}` : `?sort=${value}`}`}
                  className={`rounded-[1.25rem] px-4 py-3 text-sm font-semibold ${
                    sort === value
                      ? "bg-[var(--foreground)] text-[var(--surface)]"
                      : "border border-[var(--line)] bg-white text-[var(--foreground)]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] p-4 text-sm leading-7 text-[var(--muted)]">
            Additional marketplace filters can be layered on next:
            <br />
            price range
            <br />
            distance filter
            <br />
            posting date
            <br />
            saved search alerts
          </div>
        </aside>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-5">
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">
                Query: {q || "none"}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">
                Category: {category || "all"}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">
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
              <div className="md:col-span-2 xl:col-span-3 rounded-[2rem] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.7)] px-6 py-10 text-sm text-[var(--muted)]">
                No listings matched this search. Try another keyword or reset the
                category filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
