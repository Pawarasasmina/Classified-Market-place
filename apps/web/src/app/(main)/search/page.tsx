import Link from "next/link";
import { ListingCard } from "@/components/marketplace/listing-card";
import { categories, listings } from "@/lib/phase1-data";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
  }>;
};

function matchesSearch(source: string, query: string) {
  return source.toLowerCase().includes(query.toLowerCase());
}

export default async function SearchPage(props: SearchPageProps) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "";
  const sort = searchParams.sort ?? "newest";

  const filtered = listings
    .filter((listing) => listing.status === "Active")
    .filter((listing) => (category ? listing.categorySlug === category : true))
    .filter((listing) =>
      q
        ? matchesSearch(
            `${listing.title} ${listing.description} ${listing.location}`,
            q
          )
        : true
    )
    .sort((left, right) => {
      if (sort === "price-asc") return left.priceValue - right.priceValue;
      if (sort === "price-desc") return right.priceValue - left.priceValue;
      return 0;
    });

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 grid gap-6 xl:grid-cols-[0.74fr_0.26fr]">
        <div className="rounded-[2.25rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Search MVP
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
            Browse active listings with category filters and Phase 1 sort options.
          </h1>
          <p className="mt-4 text-base leading-8 text-[var(--muted)]">
            Phase 1 search covers browse results, category filtering, basic
            sorting, active listing enforcement, and a clear path into listing
            detail and chat.
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
                ["price-asc", "Price low to high"],
                ["price-desc", "Price high to low"],
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
            Additional Phase 1 placeholders:
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
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} compact />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
