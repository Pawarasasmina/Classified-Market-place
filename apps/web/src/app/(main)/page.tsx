import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { ListingCard } from "@/components/marketplace/listing-card";
import { hasAnyAdminPermission } from "@/lib/admin-permissions";
import { getSessionUser } from "@/lib/auth-dal";
import {
  buildMarketplaceCategoryTree,
  flattenMarketplaceCategoryTree,
} from "@/lib/category-tree";
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

  if (hasAnyAdminPermission(user?.role) && !customerPreview) {
    redirect("/admin");
  }

  const [categories, listings] = await Promise.all([
    fetchCategories(),
    fetchListings({ take: 9 }),
  ]);

  const categoryTree = buildMarketplaceCategoryTree(categories);
  const flatCategories = flattenMarketplaceCategoryTree(categoryTree);
  const popularCategories = categoryTree.slice(0, 8);
  const featuredListings = listings.slice(0, 6);
  const activeCategoryCount = categories.filter(
    (category) => category.isActive,
  ).length;
  const sellerSteps = [
    "Create your account",
    "Post clear item details",
    "Chat with interested buyers",
  ];

  return (
    <div className="page home-marketplace-page grid gap-8 lg:gap-10">
      <section className="home-marketplace-hero grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="panel home-marketplace-panel">
          <div className="home-marketplace-topline">
            <span className="section-eyebrow">Marketplace home</span>
            <span className="home-marketplace-note">
              {listings.length}+ live listings
            </span>
          </div>
          <div className="home-marketplace-copyblock mt-3 grid gap-2">
            <h1 className="home-marketplace-title">
              Sell items faster and help buyers find them quickly.
            </h1>
            <p className="home-marketplace-copy">
              A cleaner marketplace homepage focused on discovery, listing
              visibility, and faster buyer contact across products, property,
              vehicles, and services.
            </p>
          </div>

          <form
            action="/search"
            className="home-search-compact mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]"
          >
            {customerPreview ? (
              <input type="hidden" name="view" value="customer" />
            ) : null}
            <label className="home-search-field">
              <span className="field-label">Search items</span>
              <input
                name="q"
                className="surface-input text-sm"
                placeholder="Phone, car, apartment, sofa..."
              />
            </label>
            <label className="home-search-field">
              <span className="field-label">Category</span>
              <select name="category" className="surface-input text-sm">
                <option value="">All categories</option>
                {flatCategories.map(({ category, depth }) => (
                  <option key={category.slug} value={category.slug}>
                    {"- ".repeat(depth)}
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="home-search-field">
              <span className="field-label">Location</span>
              <input
                name="location"
                className="surface-input text-sm"
                placeholder="City or area"
              />
            </label>
            <button className="action-primary home-search-submit px-5 py-3 text-sm font-bold">
              Search
            </button>
          </form>

          <div className="home-marketplace-actions mt-5 flex flex-wrap gap-3">
            <Link
              href={previewHref("/sell", customerPreview)}
              className="action-primary px-5 py-3 text-sm font-bold"
            >
              Post your item
            </Link>
            <Link
              href={previewHref("/search", customerPreview)}
              className="action-secondary px-5 py-3 text-sm font-bold"
            >
              Browse listings
            </Link>
          </div>

          <div className="home-marketplace-mini-stats mt-6 grid gap-3 sm:grid-cols-3">
            <div className="home-stat-card">
              <p className="field-label">Categories</p>
              <p className="mt-2 text-xl font-black">{activeCategoryCount}</p>
            </div>
            <div className="home-stat-card">
              <p className="field-label">Featured items</p>
              <p className="mt-2 text-xl font-black">{featuredListings.length}</p>
            </div>
            <div className="home-stat-card">
              <p className="field-label">Seller flow</p>
              <p className="mt-2 text-xl font-black">Simple</p>
            </div>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="panel home-seller-panel">
            <p className="section-eyebrow">Start selling</p>
            <h2 className="mt-2 text-xl font-black">
              Listing an item should feel quick and practical.
            </h2>
            <div className="mt-4 grid gap-3">
              {sellerSteps.map((step, index) => (
                <div key={step} className="home-step-row">
                  <span className="home-step-index">0{index + 1}</span>
                  <span className="text-sm font-semibold">{step}</span>
                </div>
              ))}
            </div>
            <Link
              href={previewHref("/sell", customerPreview)}
              className="quick-action home-inline-action mt-5"
            >
              Create a listing
            </Link>
          </div>
        </aside>
      </section>

      <section className="marketplace-section">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Browse by category</p>
            <h2 className="home-section-title">
              High-traffic sections for faster buying and selling.
            </h2>
          </div>
          <Link
            href={previewHref("/categories", customerPreview)}
            className="text-sm font-bold text-[var(--brand-strong)]"
          >
            View all categories
          </Link>
        </div>

        <div className="home-category-grid">
          {popularCategories.map((category) => (
            <Link
              key={category.slug}
              href={previewHref(
                `/search?category=${category.slug}`,
                customerPreview,
              )}
              className="home-category-card"
            >
              <span className="category-icon-badge">
                <CategoryIcon slug={category.slug} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-black">{category.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                  {category.description}
                </p>
              </div>
              <span className="home-category-meta">{category.countLabel}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="marketplace-section">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">Fresh listings</p>
              <h2 className="home-section-title">
                Items buyers can discover right now.
              </h2>
            </div>
            <Link
              href={previewHref("/search", customerPreview)}
              className="text-sm font-bold text-[var(--brand-strong)]"
            >
              See all listings
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredListings.map((listing) => (
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
          <div className="panel home-side-card">
            <p className="section-eyebrow">Why this layout works</p>
            <div className="mt-3 grid gap-3 text-sm leading-6 text-[var(--muted)]">
              <p>Buyers reach live listings faster.</p>
              <p>Sellers see a clear posting action immediately.</p>
              <p>Category discovery stays visible without oversized blocks.</p>
            </div>
          </div>

          <div className="panel home-side-card">
            <p className="section-eyebrow">Next action</p>
            <h3 className="mt-2 text-lg font-black">
              Post one item and start collecting interest.
            </h3>
            <Link
              href={previewHref("/sell", customerPreview)}
              className="action-primary mt-4 inline-flex px-4 py-3 text-sm font-bold"
            >
              Post a listing
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
