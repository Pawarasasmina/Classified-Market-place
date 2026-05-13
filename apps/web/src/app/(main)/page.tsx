import Link from "next/link";
import { ListingCard } from "@/components/marketplace/listing-card";
import { fetchCategories, fetchListings } from "@/lib/marketplace-api";

export default async function HomePage() {
  const [categories, listings] = await Promise.all([
    fetchCategories(),
    fetchListings({ take: 6 }),
  ]);

  return (
    <div className="page grid gap-8">
      <section className="panel border-[var(--line)] bg-white">
        <h1 className="text-3xl font-bold">Classified Marketplace MVP</h1>
        <p className="mt-2 text-[var(--muted)]">
          Register, post listings with photos, browse categories, search, chat, and moderate listings.
        </p>
        <form action="/search" className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            name="q"
            className="rounded-md border border-[var(--line)] px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            placeholder="Search cars, phones, apartments..."
          />
          <button className="action-primary px-4 py-2 font-semibold">
            Search
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Categories</h2>
          <Link href="/categories" className="text-sm font-semibold text-[var(--brand-strong)]">
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.slug}
              href={`/search?category=${category.slug}`}
              className="panel transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
            >
              <h3 className="font-semibold">{category.name}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Latest active listings</h2>
          <Link href="/sell" className="action-primary px-3 py-2 text-sm font-semibold">
            Post listing
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
