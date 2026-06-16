import Link from "next/link";
import { redirect } from "next/navigation";
import { AdvertisementBannerRotator } from "@/components/marketplace/advertisement-banner-rotator";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { hasAnyAdminPermission } from "@/lib/admin-permissions";
import { getSessionContext } from "@/lib/auth-dal";
import {
  buildMarketplaceCategoryTree,
  flattenMarketplaceCategoryTree,
  type MarketplaceCategoryNode,
} from "@/lib/category-tree";
import { getListingMedia } from "@/lib/listing-media";
import type { MarketplaceListing } from "@/lib/marketplace";
import {
  fetchCategories,
  fetchHomeAdvertisementBanners,
  fetchMySavedListings,
  fetchListings,
} from "@/lib/marketplace-api";

type HomePageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

type CategoryColumn = {
  slug: string;
  title: string;
  href: string;
  description: string;
  imageUrl: string;
  countLabel: string;
  links: Array<{
    label: string;
    href: string;
    featured?: boolean;
  }>;
};

type ListingRail = {
  title: string;
  categorySlug: string;
  items: MarketplaceListing[];
};

const heroStats = [
  "Buy, sell, rent, hire",
  "Verified marketplace accounts",
  "Fresh local listings",
];

function previewHref(path: string, customerPreview: boolean) {
  if (!customerPreview) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}view=customer`;
}

function categoryHref(slug: string, customerPreview: boolean) {
  return previewHref(`/search?category=${slug}`, customerPreview);
}

function buildCategoryColumns(
  categoryTree: MarketplaceCategoryNode[],
  customerPreview: boolean,
): CategoryColumn[] {
  const leafFallback = flattenMarketplaceCategoryTree(categoryTree)
    .map(({ category }) => category)
    .filter((category) => category.nestedChildren.length === 0);

  return categoryTree.slice(0, 8).map((category, index) => {
    const children = category.nestedChildren.length
      ? category.nestedChildren
      : leafFallback.slice(index * 5, index * 5 + 5);
    const links = children.slice(0, 5).map((child, childIndex) => ({
      label: child.name,
      href: categoryHref(child.slug, customerPreview),
      featured: childIndex === 0 && child.countLabel !== "Live inventory",
    }));

    return {
      slug: category.slug,
      title: category.name,
      href: categoryHref(category.slug, customerPreview),
      description: category.description,
      imageUrl: category.imageUrl,
      countLabel: category.countLabel,
      links,
    };
  });
}

function buildListingRails(
  listings: MarketplaceListing[],
  flatCategories: MarketplaceCategoryNode[],
) {
  const categoriesBySlug = new Map(
    flatCategories.map((category) => [category.slug, category]),
  );
  const categoryOrder = new Map(
    flatCategories.map((category, index) => [category.slug, index]),
  );
  const railsBySlug = new Map<string, ListingRail>();

  for (const listing of listings) {
    const category = categoriesBySlug.get(listing.categorySlug);
    const categorySlug = category?.slug ?? listing.categorySlug;
    const title = `Popular in ${category?.name ?? listing.subcategory}`;
    const rail = railsBySlug.get(categorySlug);

    if (rail) {
      rail.items.push(listing);
    } else {
      railsBySlug.set(categorySlug, {
        title,
        categorySlug,
        items: [listing],
      });
    }
  }

  return Array.from(railsBySlug.values()).sort(
    (first, second) =>
      (categoryOrder.get(first.categorySlug) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(second.categorySlug) ?? Number.MAX_SAFE_INTEGER),
  );
}

function HomeListingTile({
  listing,
  customerPreview,
  showCategory = false,
}: {
  listing: MarketplaceListing;
  customerPreview: boolean;
  showCategory?: boolean;
}) {
  const media = getListingMedia(listing);

  return (
    <article className="home-listing-tile">
      <Link
        href={previewHref(`/listings/${listing.id}`, customerPreview)}
        className="home-listing-media"
      >
        <img src={media.src} alt={media.alt} />
        <span
          aria-hidden="true"
          className="home-listing-media-shade"
          style={{ background: media.overlay }}
        />
      </Link>
      <div className="home-listing-copy">
        <p className="home-listing-price">{listing.priceLabel}</p>
        <Link
          href={previewHref(`/listings/${listing.id}`, customerPreview)}
          className="home-listing-title"
        >
          {listing.title}
        </Link>
        {showCategory ? (
          <p className="home-listing-category">{listing.subcategory}</p>
        ) : null}
        <p className="home-listing-meta">
          {listing.location} · {listing.postedLabel}
        </p>
      </div>
    </article>
  );
}

function ListingRailSection({
  rail,
  customerPreview,
}: {
  rail: ListingRail;
  customerPreview: boolean;
}) {
  const browseHref = categoryHref(rail.categorySlug, customerPreview);

  return (
    <section className="home-popular-section">
      <div className="home-popular-head">
        <h2>{rail.title}</h2>
        <Link href={browseHref}>View all</Link>
      </div>
      <div className="home-listing-rail">
        {rail.items.map((listing) => (
          <HomeListingTile
            key={`${rail.title}-${listing.id}`}
            listing={listing}
            customerPreview={customerPreview}
            showCategory
          />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage(props: HomePageProps) {
  const searchParams = await props.searchParams;
  const customerPreview = searchParams.view === "customer";
  const session = await getSessionContext();
  const user = session?.user ?? null;

  if (hasAnyAdminPermission(user?.role) && !customerPreview) {
    redirect("/admin");
  }

  const [categories, listings, advertisementBanners, favoriteListings] = await Promise.all([
    fetchCategories(),
    fetchListings({ take: 100 }),
    fetchHomeAdvertisementBanners(),
    session ? fetchMySavedListings(session.accessToken).catch(() => []) : [],
  ]);

  const categoryTree = buildMarketplaceCategoryTree(categories);
  const mainCategories = categoryTree.map((category) => category);
  const flatCategories = flattenMarketplaceCategoryTree(categoryTree).map(
    ({ category }) => category,
  );
  const categoryColumns = buildCategoryColumns(categoryTree, customerPreview);
  const rails = buildListingRails(listings, flatCategories);
  const activeCategoryCount = categories.filter(
    (category) => category.isActive,
  ).length;

  return (
    <div className="home-classified-page">
      <section className="home-classified-hero">
        <div className="home-hero-overlay">
          <p className="home-hero-kicker">
            The best place to buy, sell, rent, and find services locally
          </p>
          <form action="/search" className="home-hero-search">
            {customerPreview ? (
              <input type="hidden" name="view" value="customer" />
            ) : null}
            <input
              name="q"
              placeholder="Try searching for villa, iPhone, sofa, car or job"
              aria-label="Search listings"
            />
            <select name="category" aria-label="Choose category">
              <option value="">All categories</option>
              {mainCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
            <button type="submit">Search</button>
          </form>
          <div className="home-hero-stats">
            {heroStats.map((stat) => (
              <span key={stat}>{stat}</span>
            ))}
          </div>
        </div>
      </section>

      <AdvertisementBannerRotator
        banners={advertisementBanners}
        customerPreview={customerPreview}
      />

      <section className="home-category-directory">
        <div className="home-section-heading">
          <h2>Popular Categories</h2>
          <p>{activeCategoryCount} active categories across the marketplace</p>
        </div>
        <div className="home-category-columns">
          {categoryColumns.map((column) => (
            <div key={column.title} className="home-category-column">
              <Link href={column.href} className="home-category-column-title">
                <CategoryIcon slug={column.slug} className="h-4 w-4" />
                <span>{column.title}</span>
              </Link>
              <div className="home-category-link-list">
                {column.links.map((link) => (
                  <Link key={link.href} href={link.href} className="home-category-link-item">
                    <span>{link.label}</span>
                    {link.featured ? (
                      <span className="home-category-link-badge">New</span>
                    ) : null}
                  </Link>
                ))}
              </div>
              <Link href={column.href} className="home-category-all-link">
                <span>All in {column.title}</span>
                <span aria-hidden="true" className="home-category-all-arrow">
                  &gt;
                </span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="home-trust-band">
        <div>
          <strong>Verify your account</strong>
          <span>Build trust with buyers and sellers.</span>
        </div>
        <div>
          <strong>Get more visibility</strong>
          <span>Boost important listings when demand is high.</span>
        </div>
        <div>
          <strong>Enhance your credibility</strong>
          <span>Ratings, reviews, and badges help profiles stand out.</span>
        </div>
        <Link href={previewHref(user ? "/profile" : "/register", customerPreview)}>
          Get verified
        </Link>
      </section>

      <section id="home-favorites" className="home-favorites-section">
        <div className="home-favorites-tabs" aria-label="Homepage listing tabs">
          <a href="#home-listings">All listings</a>
          <a href="#home-favorites" aria-current="page">
            Favorites
          </a>
        </div>
        <div className="home-popular-head">
          <div>
            <h2>Favorite listings</h2>
            <p>
              {session
                ? favoriteListings.length
                  ? `${favoriteListings.length} saved item${
                      favoriteListings.length === 1 ? "" : "s"
                    } in your shortlist`
                  : "Your saved listings will appear here."
                : "Sign in to save listings and compare them from the homepage."}
            </p>
          </div>
          <Link href={previewHref(session ? "/saved" : "/login?next=/", customerPreview)}>
            {session ? "View saved" : "Sign in"}
          </Link>
        </div>
        {session && favoriteListings.length ? (
          <div className="home-listing-rail home-favorites-rail">
            {favoriteListings.slice(0, 8).map((listing) => (
              <HomeListingTile
                key={`favorite-${listing.id}`}
                listing={listing}
                customerPreview={customerPreview}
                showCategory
              />
            ))}
          </div>
        ) : (
          <div className="home-favorites-empty">
            <strong>
              {session ? "No favorites yet." : "Build your favorites list."}
            </strong>
            <span>
              {session
                ? "Tap Favorite on a listing detail page to add it here."
                : "Sign in, open a listing, and tap Favorite to keep it close."}
            </span>
          </div>
        )}
      </section>

      <div className="home-popular-stack">
        <span id="home-listings" className="home-anchor-offset" />
        {rails.length ? (
          rails.map((rail) => (
            <ListingRailSection
              key={rail.categorySlug}
              rail={rail}
              customerPreview={customerPreview}
            />
          ))
        ) : (
          <section className="home-all-items-empty">
            <h2>No live items yet</h2>
            <p>Published listings will appear here as soon as they are available.</p>
            <Link href={previewHref("/sell", customerPreview)}>Post the first item</Link>
          </section>
        )}
      </div>

      <section className="home-app-strip">
        <div>
          <p>Find amazing deals on the go</p>
          <h2>Download the app now!</h2>
        </div>
        <div className="home-app-buttons" aria-label="App download links">
          <span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path
                d="M15.6 3.2c.1 1.2-.4 2.3-1.1 3.1-.8.9-2 1.5-3.1 1.4-.1-1.1.4-2.2 1.1-3 .8-.9 2-1.5 3.1-1.5Z"
                fill="currentColor"
              />
              <path
                d="M19.2 17.1c-.5 1.1-.8 1.6-1.5 2.6-1 1.4-2.4 3.1-4.1 3.1-1.5 0-1.9-1-3.9-1s-2.5 1-3.9 1c-1.7 0-3-1.6-4-3-2.7-4-3-8.7-1.3-11.2 1.2-1.8 3-2.8 4.7-2.8 1.8 0 2.9 1 4.4 1s2.4-1 4.4-1c1.5 0 3.2.8 4.4 2.3-3.8 2.1-3.2 7.5.8 9Z"
                fill="currentColor"
              />
            </svg>
            App Store
          </span>
          <span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M4 3.8v16.4l9.6-8.2L4 3.8Z" fill="#9EE6A8" />
              <path d="m13.6 12 2.7-2.3L5.2 3.4 13.6 12Z" fill="#6DD7FF" />
              <path d="m13.6 12-8.4 8.6 11.1-6.3-2.7-2.3Z" fill="#FFD166" />
              <path d="m16.3 9.7 3.2 1.8c.5.3.5.7 0 1l-3.2 1.8-2.7-2.3 2.7-2.3Z" fill="#FF7A90" />
            </svg>
            Google Play
          </span>
          <span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" />
              <rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" opacity="0.72" />
              <rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" opacity="0.72" />
              <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" />
            </svg>
            AppGallery
          </span>
        </div>
      </section>
    </div>
  );
}
