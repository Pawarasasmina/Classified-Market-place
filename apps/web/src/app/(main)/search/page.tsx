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

export default async function SearchPage(props: SearchPageProps) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const category = searchParams.category ?? "";
  const location = searchParams.location ?? "";
  const sort = normalizeSort(searchParams.sort);
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

  return (
    <div className="page grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Search Results</h1>
        <p className="mt-2 text-slate-600">{listings.length} active listings found.</p>
      </div>

      <form className="panel grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <input name="q" defaultValue={q} placeholder="Keyword" className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:col-span-2" />
        <select name="category" defaultValue={category} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.parentSlug ? "- " : ""}
              {item.name}
            </option>
          ))}
        </select>
        <input name="location" defaultValue={location} placeholder="Location" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="sort" defaultValue={sort} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="newest">Newest</option>
          <option value="price_asc">Price low to high</option>
          <option value="price_desc">Price high to low</option>
        </select>
        <button className="action-primary px-4 py-2 text-sm font-semibold">
          Apply
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {listings.length ? (
          listings.map((listing) => <ListingCard key={listing.id} listing={listing} compact />)
        ) : (
          <div className="panel md:col-span-2 lg:col-span-3">No active listings matched this search.</div>
        )}
      </div>
    </div>
  );
}
