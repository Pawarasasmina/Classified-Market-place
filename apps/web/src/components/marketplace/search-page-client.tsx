"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import {
  buildMarketplaceCategoryTree,
} from "@/lib/category-tree";
import { getListingMedia } from "@/lib/listing-media";
import type {
  ApiListing,
  AttributeField,
  MarketplaceCategory,
  MarketplaceListing,
} from "@/lib/marketplace";
import { mapListing } from "@/lib/marketplace";

type SearchPageClientProps = {
  apiBaseUrl: string;
  categories: MarketplaceCategory[];
  listings: MarketplaceListing[];
  selectedCategorySlug?: string;
  query: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  sort: "recommended" | "newest" | "price_asc" | "price_desc";
  attributeValues: Record<string, string>;
  customerPreview: boolean;
  isShowingRelatedListings: boolean;
  relatedScopeLabel: string;
};

type SearchDraftState = {
  q: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  sort: "recommended" | "newest" | "price_asc" | "price_desc";
  category: string;
  attributeValues: Record<string, string>;
};

const inputClassName =
  "h-12 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)] shadow-[0_8px_24px_rgba(15,23,42,0.06)]";

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

function previewHref(path: string, customerPreview: boolean) {
  if (!customerPreview) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}view=customer`;
}

function buildCategoryPath(
  category: MarketplaceCategory | undefined,
  categoryBySlug: Map<string, MarketplaceCategory>,
) {
  if (!category) {
    return [];
  }

  const path: MarketplaceCategory[] = [];
  const seen = new Set<string>();
  let current: MarketplaceCategory | undefined = category;

  while (current && !seen.has(current.slug)) {
    path.unshift(current);
    seen.add(current.slug);
    current = current.parentSlug
      ? categoryBySlug.get(current.parentSlug) ?? undefined
      : undefined;
  }

  return path;
}

function getTopLevelCategory(
  category: MarketplaceCategory | undefined,
  categoryBySlug: Map<string, MarketplaceCategory>,
) {
  const path = buildCategoryPath(category, categoryBySlug);
  return path[0];
}

function SearchResultCard({
  listing,
  customerPreview,
}: {
  listing: MarketplaceListing;
  customerPreview: boolean;
}) {
  const media = getListingMedia(listing);
  const href = previewHref(`/listings/${listing.id}`, customerPreview);

  return (
    <article className="overflow-hidden rounded-[1.7rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_22px_54px_rgba(15,23,42,0.08)]">
      <div className="grid gap-0 md:grid-cols-[21rem_1fr]">
        <Link href={href} className="relative block min-h-[17rem] overflow-hidden">
          <img
            src={media.src}
            alt={media.alt}
            className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: media.overlay }}
          />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {listing.isBoosted ? (
              <span className="rounded-full bg-[var(--brand)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white">
                {listing.boostLabel ?? "Boosted"}
              </span>
            ) : null}
            <span className="rounded-full bg-white/92 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">
              {listing.subcategory}
            </span>
          </div>
        </Link>

        <div className="grid gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[1.7rem] font-black leading-none text-[var(--foreground)]">
                {listing.priceLabel}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                <span>{listing.subcategory}</span>
                <span>•</span>
                <span>{listing.location}</span>
                <span>•</span>
                <span>{listing.postedLabel}</span>
              </div>
            </div>
            <span className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--muted)]">
              {listing.condition}
            </span>
          </div>

          <div className="grid gap-2">
            <Link
              href={href}
              className="line-clamp-2 text-[1.15rem] font-black leading-7 text-[var(--foreground)]"
            >
              {listing.title}
            </Link>
            <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">
              {listing.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {listing.featureBullets.slice(0, 4).map((feature) => (
              <span
                key={`${listing.id}-${feature}`}
                className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
              >
                {feature}
              </span>
            ))}
          </div>

          <div className="grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--foreground)]">
                {listing.sellerDisplayName ?? "Marketplace seller"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {listing.viewCount} • {listing.chatCount.toLocaleString()} inquiries
                • {listing.saveCount.toLocaleString()} saves
              </p>
            </div>
            <Link
              href={href}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(109,70,255,0.24)]"
            >
              View details
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function AttributeInput({
  field,
  value,
  onChange,
}: {
  field: AttributeField;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  if (field.type === "select") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        <option value="">Any {field.label}</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "toggle") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        <option value="">Any {field.label}</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type={field.type === "number" ? "number" : "text"}
      inputMode={field.type === "number" ? "numeric" : undefined}
      placeholder={field.placeholder ?? `Any ${field.label}`}
      className={inputClassName}
    />
  );
}

export function SearchPageClient({
  apiBaseUrl,
  categories,
  listings,
  selectedCategorySlug,
  query,
  location,
  minPrice,
  maxPrice,
  sort,
  attributeValues,
  customerPreview,
  isShowingRelatedListings,
  relatedScopeLabel,
}: SearchPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resolvedListings, setResolvedListings] = useState(listings);
  const [isRecoveringListings, setIsRecoveringListings] = useState(false);
  const [draft, setDraft] = useState<SearchDraftState>({
    q: query,
    location,
    minPrice,
    maxPrice,
    sort,
    category: selectedCategorySlug ?? "",
    attributeValues,
  });

  useEffect(() => {
    setResolvedListings(listings);
  }, [listings]);

  useEffect(() => {
    setDraft({
      q: query,
      location,
      minPrice,
      maxPrice,
      sort,
      category: selectedCategorySlug ?? "",
      attributeValues,
    });
  }, [attributeValues, location, maxPrice, minPrice, query, selectedCategorySlug, sort]);

  const categoryTree = useMemo(
    () => buildMarketplaceCategoryTree(categories),
    [categories],
  );
  const categoryBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories],
  );

  const selectedCategory = draft.category
    ? categoryBySlug.get(draft.category)
    : undefined;
  const selectedMainCategory = getTopLevelCategory(
    selectedCategory,
    categoryBySlug,
  );
  const activeMainCategoryNode = selectedMainCategory
    ? categoryTree.find((category) => category.slug === selectedMainCategory.slug)
    : undefined;
  const activeMainCategory = selectedMainCategory;
  const subcategoryNodes = activeMainCategoryNode?.nestedChildren ?? [];
  const dynamicCategory = selectedCategory;
  const dynamicFields = dynamicCategory?.schema ?? [];
  const quickFields = dynamicFields.slice(0, 3);
  const moreFields = dynamicFields.slice(3);
  const breadcrumb = buildCategoryPath(selectedCategory, categoryBySlug);

  useEffect(() => {
    const hasServerListings = listings.length > 0;
    const hasSearchContext =
      Boolean(selectedCategorySlug) ||
      Boolean(query.trim()) ||
      Boolean(location.trim()) ||
      Boolean(minPrice.trim()) ||
      Boolean(maxPrice.trim()) ||
      Object.values(attributeValues).some((value) => value.trim().length > 0);

    if (hasServerListings || !hasSearchContext) {
      return;
    }

    const controller = new AbortController();

    async function recoverListings() {
      setIsRecoveringListings(true);

      try {
        const params = new URLSearchParams();

        if (query.trim()) {
          params.set("search", query.trim());
        }

        if (selectedCategorySlug) {
          params.set("categorySlug", selectedCategorySlug);
        }

        if (location.trim()) {
          params.set("location", location.trim());
        }

        if (minPrice.trim()) {
          params.set("minPrice", minPrice.trim());
        }

        if (maxPrice.trim()) {
          params.set("maxPrice", maxPrice.trim());
        }

        if (sort && sort !== "recommended") {
          params.set("sort", sort);
        }

        const typedAttributeFilters = Object.fromEntries(
          dynamicFields.flatMap((field) => {
            const value = attributeValues[field.key] ?? "";
            const typedValue = coerceAttributeValue(field, value);
            return typedValue === undefined ? [] : [[field.key, typedValue]];
          }),
        );

        if (Object.keys(typedAttributeFilters).length > 0) {
          params.set("attributeFilters", JSON.stringify(typedAttributeFilters));
        }

        params.set("take", "12");

        const response = await fetch(
          `${apiBaseUrl.replace(/\/$/, "")}/listings?${params.toString()}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (!response.ok) {
          return;
        }

        const apiListings = (await response.json()) as ApiListing[];
        setResolvedListings(apiListings.map(mapListing));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResolvedListings([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsRecoveringListings(false);
        }
      }
    }

    void recoverListings();

    return () => {
      controller.abort();
    };
  }, [
    apiBaseUrl,
    attributeValues,
    dynamicFields,
    listings.length,
    location,
    maxPrice,
    minPrice,
    query,
    selectedCategorySlug,
    sort,
  ]);

  const activeFilterLabels = [
    draft.q.trim() ? `Keyword: ${draft.q.trim()}` : null,
    selectedCategory?.name ? `Category: ${selectedCategory.name}` : null,
    draft.location.trim() ? `Location: ${draft.location.trim()}` : null,
    draft.minPrice.trim() ? `Min price: ${draft.minPrice.trim()}` : null,
    draft.maxPrice.trim() ? `Max price: ${draft.maxPrice.trim()}` : null,
    ...dynamicFields.flatMap((field) => {
      const value = draft.attributeValues[field.key] ?? "";
      return value ? [`${field.label}: ${value}`] : [];
    }),
  ].filter(Boolean) as string[];

  const visibleListings = resolvedListings;

  const resultTitle = selectedCategory?.name ?? "All listings";

  function buildHref(nextState: SearchDraftState) {
    const params = new URLSearchParams();

    if (nextState.q.trim()) params.set("q", nextState.q.trim());
    if (nextState.category) params.set("category", nextState.category);
    if (nextState.location.trim()) params.set("location", nextState.location.trim());
    if (nextState.minPrice.trim()) params.set("minPrice", nextState.minPrice.trim());
    if (nextState.maxPrice.trim()) params.set("maxPrice", nextState.maxPrice.trim());
    if (nextState.sort !== "recommended") params.set("sort", nextState.sort);
    if (customerPreview) params.set("view", "customer");

    for (const field of dynamicFields) {
      const value = nextState.attributeValues[field.key] ?? "";
      if (value.trim()) {
        params.set(`attr_${field.key}`, value.trim());
      }
    }

    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  function navigate(nextState: SearchDraftState) {
    startTransition(() => {
      router.push(buildHref(nextState));
      setDrawerOpen(false);
    });
  }

  function updateAttributeValue(fieldKey: string, value: string) {
    setDraft((current) => ({
      ...current,
      attributeValues: {
        ...current.attributeValues,
        [fieldKey]: value,
      },
    }));
  }

  function handleMainCategorySelect(slug: string) {
    const nextState: SearchDraftState = {
      ...draft,
      category: slug,
      attributeValues: {},
    };
    setDraft(nextState);
    navigate(nextState);
  }

  function handleSubcategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const nextState: SearchDraftState = {
      ...draft,
      category: value || activeMainCategory?.slug || "",
      attributeValues: {},
    };
    setDraft(nextState);
    navigate(nextState);
  }

  function handleApply() {
    const typedAttributeValues = Object.fromEntries(
      dynamicFields.flatMap((field) => {
        const rawValue = draft.attributeValues[field.key] ?? "";
        const typedValue = coerceAttributeValue(field, rawValue);
        return typedValue === undefined ? [] : [[field.key, String(typedValue)]];
      }),
    );

    navigate({
      ...draft,
      attributeValues: typedAttributeValues,
    });
  }

  function clearExtendedFilters() {
    setDraft((current) => ({
      ...current,
      q: "",
      location: "",
      minPrice: "",
      maxPrice: "",
      attributeValues: {},
    }));
  }

  return (
    <div className="page grid gap-6">
      <section className="grid gap-4 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_28px_64px_rgba(15,23,42,0.08)] sm:p-5">
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {categoryTree.map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => handleMainCategorySelect(category.slug)}
              className={`rounded-full px-4 py-2.5 text-sm font-black ${
                activeMainCategory?.slug === category.slug
                  ? "bg-[var(--brand)] text-white shadow-[0_12px_28px_rgba(109,70,255,0.22)]"
                  : "border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)]"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.05fr_1.2fr_0.9fr_0.9fr_0.95fr_auto]">
          <label className="grid gap-1.5">
            <span className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Location
            </span>
            <input
              value={draft.location}
              onChange={(event) =>
                setDraft((current) => ({ ...current, location: event.target.value }))
              }
              placeholder="City or area"
              className={inputClassName}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Subcategory
            </span>
            <select
              value={
                subcategoryNodes.some((item) => item.slug === draft.category)
                  ? draft.category
                  : ""
              }
              onChange={handleSubcategoryChange}
              className={inputClassName}
            >
              <option value="">{activeMainCategory?.name ?? "All"} overview</option>
              {subcategoryNodes.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Min price
            </span>
            <input
              value={draft.minPrice}
              onChange={(event) =>
                setDraft((current) => ({ ...current, minPrice: event.target.value }))
              }
              placeholder="Any"
              inputMode="numeric"
              className={inputClassName}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Max price
            </span>
            <input
              value={draft.maxPrice}
              onChange={(event) =>
                setDraft((current) => ({ ...current, maxPrice: event.target.value }))
              }
              placeholder="Any"
              inputMode="numeric"
              className={inputClassName}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Keyword
            </span>
            <input
              value={draft.q}
              onChange={(event) =>
                setDraft((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Search by title or keyword"
              className={inputClassName}
            />
          </label>

          <div className="grid gap-1.5">
            <span className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              More
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-5 text-sm font-black text-[var(--foreground)]"
            >
              Filters
              {dynamicFields.length ? ` (${dynamicFields.length})` : ""}
            </button>
          </div>
        </div>

        {quickFields.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quickFields.map((field) => (
              <label key={field.key} className="grid gap-1.5">
                <span className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {field.label}
                </span>
                <AttributeInput
                  field={field}
                  value={draft.attributeValues[field.key] ?? ""}
                  onChange={(value) => updateAttributeValue(field.key, value)}
                />
              </label>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
            <span>Sort</span>
            <select
              value={draft.sort}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sort: event.target.value as SearchDraftState["sort"],
                }))
              }
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price low to high</option>
              <option value="price_desc">Price high to low</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(109,70,255,0.24)] disabled:opacity-70"
          >
            {isPending ? "Applying..." : "Apply filters"}
          </button>
          <Link
            href={previewHref("/search", customerPreview)}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--line)] px-5 text-sm font-bold text-[var(--muted)]"
          >
            Reset all
          </Link>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <Link href={previewHref("/", customerPreview)} className="font-semibold text-[var(--brand-strong)]">
            Home
          </Link>
          {breadcrumb.map((item) => (
            <span key={item.slug} className="flex items-center gap-2">
              <span>›</span>
              <button
                type="button"
                onClick={() => handleMainCategorySelect(item.slug)}
                className="font-semibold text-[var(--brand-strong)]"
              >
                {item.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-black tracking-[-0.03em] text-[var(--foreground)]">
              {resultTitle}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {visibleListings.length} matching listing
              {visibleListings.length === 1 ? "" : "s"}
            </p>
          </div>
          {subcategoryNodes.length ? (
            <div className="flex max-w-full flex-wrap gap-2">
              {subcategoryNodes.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => {
                    const nextState = {
                      ...draft,
                      category: category.slug,
                      attributeValues: {},
                    };
                    setDraft(nextState);
                    navigate(nextState);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    draft.category === category.slug
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)]"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {activeFilterLabels.length ? (
          <div className="flex flex-wrap gap-2">
            {activeFilterLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--muted)]"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}

        {isShowingRelatedListings ? (
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            No exact listings were found for this subcategory yet. Showing items from{" "}
            {relatedScopeLabel} instead so the page stays useful.
          </div>
        ) : null}
      </section>

      <section className="grid gap-4">
        {visibleListings.length ? (
          visibleListings.map((listing) => (
            <SearchResultCard
              key={listing.id}
              listing={listing}
              customerPreview={customerPreview}
            />
          ))
        ) : isRecoveringListings ? (
          <div className="rounded-[1.7rem] border border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <h2 className="text-xl font-black text-[var(--foreground)]">
              Loading listings...
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Pulling the latest results for this search.
            </p>
          </div>
        ) : (
          <div className="rounded-[1.7rem] border border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <h2 className="text-xl font-black text-[var(--foreground)]">
              No listings matched these filters.
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Try a broader price range, remove one dynamic filter, or switch to a
              nearby category.
            </p>
          </div>
        )}
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            aria-label="Close filters"
            className="flex-1"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="flex h-full w-full max-w-[30rem] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[0_30px_70px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-5">
              <div>
                <p className="section-eyebrow">More filters</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">
                  {dynamicCategory?.name ?? "Search filters"}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Refine this result set without changing the current color theme.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full border border-[var(--line)] px-3 py-2 text-sm font-bold text-[var(--muted)]"
              >
                Close
              </button>
            </div>

            <div className="grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-[var(--foreground)]">Keyword</span>
                <input
                  value={draft.q}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, q: event.target.value }))
                  }
                  placeholder="Keyword, city, etc."
                  className={inputClassName}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-[var(--foreground)]">Location</span>
                <input
                  value={draft.location}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="City or area"
                  className={inputClassName}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[var(--foreground)]">
                    Min price
                  </span>
                  <input
                    value={draft.minPrice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        minPrice: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    className={inputClassName}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[var(--foreground)]">
                    Max price
                  </span>
                  <input
                    value={draft.maxPrice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        maxPrice: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    className={inputClassName}
                  />
                </label>
              </div>

              {dynamicFields.length ? (
                <div className="grid gap-4">
                  {dynamicFields.map((field) => (
                    <label key={field.key} className="grid gap-1.5">
                      <span className="text-sm font-bold text-[var(--foreground)]">
                        {field.label}
                      </span>
                      <AttributeInput
                        field={field}
                        value={draft.attributeValues[field.key] ?? ""}
                        onChange={(value) => updateAttributeValue(field.key, value)}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-4 py-5 text-sm text-[var(--muted)]">
                  Select a leaf category or subcategory to unlock its dynamic filters.
                </div>
              )}

              {moreFields.length ? (
                <div className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4 text-sm text-[var(--muted)]">
                  {moreFields.length} additional category-specific filter
                  {moreFields.length === 1 ? "" : "s"} are available here for{" "}
                  {dynamicCategory?.name}.
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] px-5 py-5">
              <button
                type="button"
                onClick={clearExtendedFilters}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--line)] text-sm font-bold text-[var(--foreground)]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isPending}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-black text-white disabled:opacity-70"
              >
                {isPending ? "Applying..." : "Apply filters"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
