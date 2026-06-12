import { SearchPageClient } from "@/components/marketplace/search-page-client";
import { unstable_noStore as noStore } from "next/cache";
import {
  fetchCategories,
  fetchListings,
  fetchListingsStrict,
} from "@/lib/marketplace-api";
import type { AttributeField, MarketplaceCategory } from "@/lib/marketplace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeSort(sort: string | undefined) {
  if (sort === "newest") return "newest" as const;
  if (sort === "price_asc") return "price_asc" as const;
  if (sort === "price_desc") return "price_desc" as const;
  return "recommended" as const;
}

function readFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function numberParam(value: string | undefined) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function coerceAttributeValue(field: AttributeField, value: string) {
  if (!value.trim()) {
    return undefined;
  }

  if (field.type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (field.type === "toggle") {
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
  }

  return value.trim();
}

function findSelectedCategory(
  categories: MarketplaceCategory[],
  slug: string | undefined,
) {
  return slug ? categories.find((category) => category.slug === slug) : undefined;
}

function buildAncestorCategorySlugs(
  categories: MarketplaceCategory[],
  selectedSlug: string | undefined,
) {
  if (!selectedSlug) {
    return [];
  }

  const categoryBySlug = new Map(
    categories.map((category) => [category.slug, category]),
  );
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let current = categoryBySlug.get(selectedSlug);

  while (current?.parentSlug && !seen.has(current.parentSlug)) {
    ancestors.push(current.parentSlug);
    seen.add(current.parentSlug);
    current = categoryBySlug.get(current.parentSlug);
  }

  return ancestors;
}

async function loadSearchListings(
  listingQuery: Parameters<typeof fetchListings>[0],
  options: {
    selectedCategorySlug?: string;
    hasAttributeFilters: boolean;
    hasQuery: boolean;
    hasLocation: boolean;
    hasMinPrice: boolean;
    hasMaxPrice: boolean;
  },
) {
  const listings = await fetchListings(listingQuery);

  if (
    listings.length > 0 ||
    !options.selectedCategorySlug ||
    options.hasAttributeFilters ||
    options.hasQuery ||
    options.hasLocation ||
    options.hasMinPrice ||
    options.hasMaxPrice
  ) {
    return listings;
  }

  try {
    return await fetchListingsStrict(listingQuery);
  } catch {
    return listings;
  }
}

export default async function SearchPage(props: SearchPageProps) {
  noStore();
  const searchParams = await props.searchParams;
  const q = readFirst(searchParams.q) ?? "";
  const category = readFirst(searchParams.category) ?? "";
  const location = readFirst(searchParams.location) ?? "";
  const minPrice = readFirst(searchParams.minPrice) ?? "";
  const maxPrice = readFirst(searchParams.maxPrice) ?? "";
  const sort = normalizeSort(readFirst(searchParams.sort));
  const customerPreview = readFirst(searchParams.view) === "customer";

  const categories = await fetchCategories();
  const selectedCategory = findSelectedCategory(categories, category);
  const selectedCategoryFields = selectedCategory?.schema ?? [];

  const attributeValues = Object.fromEntries(
    selectedCategoryFields.flatMap((field) => {
      const rawValue = readFirst(searchParams[`attr_${field.key}`]) ?? "";
      return rawValue.trim() ? [[field.key, rawValue]] : [];
    }),
  );

  const attributeFilters = Object.fromEntries(
    selectedCategoryFields.flatMap((field) => {
      const rawValue = attributeValues[field.key];
      const typedValue = rawValue ? coerceAttributeValue(field, rawValue) : undefined;
      return typedValue === undefined ? [] : [[field.key, typedValue]];
    }),
  );

  const listingQuery = {
    search: q || undefined,
    categorySlug: category || undefined,
    attributeFilters,
    location: location || undefined,
    minPrice: numberParam(minPrice),
    maxPrice: numberParam(maxPrice),
    sort,
    take: 12,
  };

  const matchingListings = await loadSearchListings(listingQuery, {
    selectedCategorySlug: category || undefined,
    hasAttributeFilters: Object.keys(attributeFilters).length > 0,
    hasQuery: Boolean(q),
    hasLocation: Boolean(location),
    hasMinPrice: Boolean(minPrice),
    hasMaxPrice: Boolean(maxPrice),
  });
  const shouldShowRelated =
    matchingListings.length === 0 &&
    selectedCategory &&
    !Object.keys(attributeFilters).length &&
    !q &&
    !location &&
    !minPrice &&
    !maxPrice;
  const ancestorCategorySlugs = shouldShowRelated
    ? buildAncestorCategorySlugs(categories, selectedCategory.slug)
    : [];
  let relatedListings: Awaited<ReturnType<typeof fetchListings>> = [];
  let relatedScopeLabel = "recent marketplace listings";

  if (shouldShowRelated) {
    for (const ancestorSlug of ancestorCategorySlugs) {
      const ancestorCategory = findSelectedCategory(categories, ancestorSlug);
      const ancestorListings = await loadSearchListings(
        {
          ...listingQuery,
          categorySlug: ancestorSlug,
          take: 12,
        },
        {
          selectedCategorySlug: ancestorSlug,
          hasAttributeFilters: Object.keys(attributeFilters).length > 0,
          hasQuery: Boolean(q),
          hasLocation: Boolean(location),
          hasMinPrice: Boolean(minPrice),
          hasMaxPrice: Boolean(maxPrice),
        },
      );

      if (ancestorListings.length) {
        relatedListings = ancestorListings;
        relatedScopeLabel = ancestorCategory?.name
          ? `${ancestorCategory.name.toLowerCase()}`
          : "a broader category";
        break;
      }
    }
  }

  const listings = matchingListings.length ? matchingListings : relatedListings;
  const isShowingRelatedListings =
    matchingListings.length === 0 && relatedListings.length > 0;

  return (
    <SearchPageClient
      apiBaseUrl={process.env.MARKETPLACE_API_URL ?? "http://127.0.0.1:3001"}
      categories={categories}
      listings={listings}
      selectedCategorySlug={category || undefined}
      query={q}
      location={location}
      minPrice={minPrice}
      maxPrice={maxPrice}
      sort={sort}
      attributeValues={attributeValues}
      customerPreview={customerPreview}
      isShowingRelatedListings={isShowingRelatedListings}
      relatedScopeLabel={relatedScopeLabel}
    />
  );
}
