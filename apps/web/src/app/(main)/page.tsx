import Image from "next/image";
import Link from "next/link";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { ListingCard } from "@/components/marketplace/listing-card";
import { getListingMedia } from "@/lib/listing-media";
import { fetchCategories, fetchListings } from "@/lib/marketplace-api";
import { quickStats, savedSearches } from "@/lib/phase1-data";

export default async function HomePage() {
  const [categories, listings] = await Promise.all([
    fetchCategories(),
    fetchListings({ take: 3 }),
  ]);

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.84)] p-8">
          <div className="inline-flex rounded-full border border-[rgba(217,93,57,0.2)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Local marketplace
          </div>

          <h1 className="display-font mt-6 max-w-4xl text-4xl font-bold leading-tight tracking-[-0.04em] text-[var(--foreground)] sm:text-5xl">
            Find homes, motors, electronics, jobs, and local services in one place.
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Browse verified listings, save the ones you love, message sellers instantly,
            and post your own ad in just a few steps.
          </p>

          <div className="mt-8 grid gap-4 rounded-[2rem] border border-[var(--line)] bg-white p-4 lg:grid-cols-[1.3fr_0.85fr_0.7fr_auto]">
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Search query
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                Apartment in Marina, Toyota Camry, iPhone 15, AC repair...
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Category
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                All categories
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Radius
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                Within 10 km
              </p>
            </div>
            <Link
              href="/search?q=marina"
              className="flex items-center justify-center rounded-[1.5rem] bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-4 text-sm font-semibold text-white"
            >
              Search listings
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--surface)]"
            >
              Browse listings
            </Link>
            <Link
              href="/sell"
              className="rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent)]"
            >
              Post your ad
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {listings.map((listing) => {
              const media = getListingMedia(listing);

              return (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="group overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white"
                >
                  <div className="relative h-36">
                    <Image
                      src={media.src}
                      alt={media.alt}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 20vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: media.overlay }}
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-[rgba(255,255,255,0.86)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-deep)]">
                      {listing.subcategory}
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {listing.title}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      {listing.priceLabel}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[2.5rem] border border-[var(--line)] bg-[linear-gradient(145deg,#193e35,#173447_58%,#4a281c)] p-8 text-[var(--surface)]">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.24em] text-[#f2d3a6]">
              Marketplace pulse
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight">
              Fresh inventory, active conversations, and a marketplace that moves quickly.
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[1.5rem] bg-[rgba(255,255,255,0.08)] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[#f2d3a6]">
                    {stat.label}
                  </p>
                  <p className="display-font mt-3 text-2xl font-bold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.85)] p-6">
            <div className="flex items-center justify-between">
              <h2 className="display-font text-2xl font-bold text-[var(--foreground)]">
                Why it works
              </h2>
              <Link href="/search" className="text-sm font-semibold text-[var(--accent)]">
                Explore now
              </Link>
            </div>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-[var(--muted)]">
              {[
                "Fast search across active local listings",
                "Simple posting flow for sellers",
                "Saved items and direct buyer chat",
                "Category browsing for property, motors, electronics, jobs, and services",
              ].map((item) => (
                <li
                  key={item}
                  className="rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-3"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Popular categories
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
              Start with the places people search most.
            </h2>
          </div>
          <Link href="/categories" className="text-sm font-semibold text-[var(--accent)]">
            View all categories
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/search?category=${category.slug}`}
              className="card-shadow rounded-[1.75rem] border border-[var(--line)] p-5"
              style={{ background: category.accent }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.82)] text-[var(--brand-deep)]">
                <CategoryIcon slug={category.slug} className="h-6 w-6" />
              </div>
              <h3 className="display-font mt-5 text-xl font-bold text-[var(--foreground)]">
                {category.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {category.description}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {category.countLabel}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-8 xl:grid-cols-[0.72fr_0.28fr]">
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                Featured listings
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                Fresh listings people can browse right now.
              </h2>
            </div>
            <Link href="/search" className="text-sm font-semibold text-[var(--accent)]">
              See more
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} compact />
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Saved searches
            </p>
            <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              Keep track of what matters to you.
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Save your favorite searches and return to them anytime.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {savedSearches.map((savedSearch) => (
                <span
                  key={savedSearch.id}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]"
                >
                  {savedSearch.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Quick actions
            </p>
            <div className="mt-4 grid gap-3">
              {[
                { href: "/register", label: "Create your account" },
                { href: "/sell", label: "Post a listing" },
                { href: "/my-listings", label: "Manage your listings" },
                { href: "/profile", label: "View your profile" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[1.5rem] border border-[var(--line)] bg-white px-4 py-4 text-sm font-semibold text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
