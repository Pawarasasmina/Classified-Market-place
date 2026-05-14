import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { ListingCard } from "@/components/marketplace/listing-card";
import { getSessionUser } from "@/lib/auth-dal";
import { fetchCategories, fetchListings } from "@/lib/marketplace-api";

type HomePageProps = {
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

export default async function HomePage(props: HomePageProps) {
  const searchParams = await props.searchParams;
  const customerPreview = searchParams.view === "customer";
  const user = await getSessionUser();

  if (user?.role.toUpperCase() === "ADMIN" && !customerPreview) {
    redirect("/admin");
  }

  const [categories, listings] = await Promise.all([
    fetchCategories(),
    fetchListings({ take: 9 }),
  ]);
  const popularCategories = categories.slice(0, 6);
  const activeCategoryCount = categories.filter((category) => category.isActive).length;
  const previewListings = listings.slice(0, 3);

  return (
    <div className="page grid gap-12">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="hero-panel overflow-hidden p-6 sm:p-8">
          <div className="hero-kicker">
            Local smart marketplace
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">
            Find homes, motors, electronics, jobs, and local services in one place.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]">
            Browse verified listings, save the ones you love, message sellers
            instantly, and post your own ad in just a few steps.
          </p>

          <form
            action="/search"
            className="hero-search-strip mt-8 grid gap-3 lg:grid-cols-[1.25fr_0.9fr_0.8fr_auto]"
          >
            {customerPreview ? <input type="hidden" name="view" value="customer" /> : null}
            <label className="hero-search-item grid gap-2">
              <span className="field-label">
                Search query
              </span>
              <input
                name="q"
                className="surface-input text-sm"
                placeholder="Cars, apartments, iPhone, AC repair..."
              />
            </label>
            <label className="hero-search-item grid gap-2">
              <span className="field-label">
                Category
              </span>
              <select name="category" className="surface-input text-sm">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.parentSlug ? "- " : ""}
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="hero-search-item grid gap-2">
              <span className="field-label">
                Location
              </span>
              <input
                name="location"
                className="surface-input text-sm"
                placeholder="Dubai Marina"
              />
            </label>
            <button className="action-primary px-5 py-3 font-bold lg:min-h-20">
              Search
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={previewHref("/search", customerPreview)}
              className="action-primary px-4 py-3 text-sm font-bold"
            >
              Browse listings
            </Link>
            <Link
              href={previewHref("/sell", customerPreview)}
              className="marketplace-header-button px-4 py-3 text-sm font-bold"
            >
              Post your ad
            </Link>
          </div>
        </div>

        <aside className="hero-panel p-6 sm:p-8">
          <p className="section-eyebrow text-[var(--accent-strong)]">Marketplace pulse</p>
          <h2 className="mt-4 max-w-xl text-3xl font-black leading-tight text-white">
            Fresh inventory, active conversations, and a marketplace that moves quickly.
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["Live listings", `${listings.length}+`],
              ["Active categories", activeCategoryCount],
              ["Saved searches", "3"],
              ["Review queue", "17 open"],
            ].map(([label, value]) => (
              <div key={label} className="metric-card">
                <p className="field-label text-[var(--accent-strong)]">{label}</p>
                <p className="mt-3 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3">
            {[
              "Verified category schemas and live search filters",
              "Simple posting flow for sellers",
              "Saved items and direct buyer chat",
            ].map((item) => (
              <div key={item} className="feature-rail text-sm">
                {item}
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="marketplace-section">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Popular categories</p>
            <h2 className="mt-2 text-3xl font-black text-white">
              Start with the places people search most.
            </h2>
          </div>
          <Link
            href={previewHref("/categories", customerPreview)}
            className="text-sm font-bold text-[var(--accent-strong)]"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {popularCategories.map((category) => (
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

      <section className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="marketplace-section">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">Featured listings</p>
              <h2 className="mt-2 text-3xl font-black text-white">
                Fresh listings people can browse right now.
              </h2>
            </div>
            <Link
              href={previewHref("/search", customerPreview)}
              className="text-sm font-bold text-[var(--accent-strong)]"
            >
              See more
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(previewListings.length ? previewListings : listings).map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                compact
                customerView={customerPreview}
              />
            ))}
          </div>
        </div>

        <aside className="grid h-fit gap-4">
          <div className="hero-panel p-6">
            <p className="section-eyebrow">Saved searches</p>
            <h3 className="mt-3 text-2xl font-black text-white">
              Keep track of what matters to you.
            </h3>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Sign in to keep favorite searches and alert settings synced to your account.
            </p>
            <Link href={previewHref("/login", customerPreview)} className="quick-action mt-5">
              Sign in to save searches
            </Link>
          </div>
          <div className="hero-panel p-6">
            <p className="section-eyebrow">Quick actions</p>
            <div className="mt-4 grid gap-3">
              <Link href={previewHref("/register", customerPreview)} className="quick-action">
                Create your account
              </Link>
              <Link href={previewHref("/sell", customerPreview)} className="quick-action">
                Post a listing
              </Link>
              <Link href={previewHref("/profile", customerPreview)} className="quick-action">
                View your profile
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
