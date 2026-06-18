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
import {
  LocationRadiusFilter,
  type LocationRadiusValue,
} from "@/components/marketplace/location-radius-filter";
import { useResolvedLocationLabel } from "@/components/marketplace/resolved-location-label";
import { formatDisplayLocation } from "@/lib/location-display";
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
  latitude: number | null;
  longitude: number | null;
  radiusKilometers: number | null;
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
  latitude: number | null;
  longitude: number | null;
  radiusKilometers: number | null;
  minPrice: string;
  maxPrice: string;
  sort: "recommended" | "newest" | "price_asc" | "price_desc";
  category: string;
  attributeValues: Record<string, string>;
};

const inputClassName =
  "h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] shadow-[0_6px_18px_rgba(15,23,42,0.05)]";

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

function formatRadiusLabel(radiusKilometers: number | null) {
  if (radiusKilometers == null) {
    return "";
  }

  return `${radiusKilometers} km radius`;
}

function DotDivider() {
  return <span className="text-[var(--muted)]">•</span>;
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
  const resolvedLocation = useResolvedLocationLabel({
    location: listing.location,
    latitude: listing.latitude,
    longitude: listing.longitude,
  });

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
                <span>{resolvedLocation}</span>
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

function SearchResultCardModern({
  listing,
  customerPreview,
}: {
  listing: MarketplaceListing;
  customerPreview: boolean;
}) {
  const media = getListingMedia(listing);
  const href = previewHref(`/listings/${listing.id}`, customerPreview);
  const thumbnails = listing.imageUrls.slice(0, 3);
  const extraImages = Math.max(listing.imageUrls.length - 3, 0);
  const resolvedLocation = useResolvedLocationLabel({
    location: listing.location,
    latitude: listing.latitude,
    longitude: listing.longitude,
  });

  return (
    <article className="overflow-hidden rounded-[1.45rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
      <div className="grid lg:grid-cols-[22rem_1fr]">
        <div className="border-b border-[var(--line)] lg:border-b-0 lg:border-r">
          <Link href={href} className="relative block aspect-[1.2/1] overflow-hidden">
            <img
              src={media.src}
              alt={media.alt}
              className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: media.overlay }}
            />
            <div className="absolute left-3 top-3 flex gap-2">
              <span className="rounded-md bg-[var(--brand)] px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white">
                Export Only
              </span>
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
              <span className="rounded-full bg-white/92 p-1.5 text-[0.9rem] text-[var(--foreground)]">
                ↗
              </span>
              <span className="rounded-full bg-white/92 p-1.5 text-[0.9rem] text-[var(--foreground)]">
                ♡
              </span>
            </div>
          </Link>

          {thumbnails.length ? (
            <div className="grid grid-cols-3 gap-[2px] border-t border-[var(--line)] bg-[var(--line)]">
              {thumbnails.map((imageUrl, index) => (
                <div
                  key={`${listing.id}-thumb-${imageUrl}`}
                  className="relative aspect-[1.45/1] bg-[var(--surface)]"
                >
                  <img
                    src={imageUrl}
                    alt={`${listing.title} preview ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {index === thumbnails.length - 1 && extraImages > 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/34 text-[1.6rem] font-black text-white">
                      +{extraImages}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[2rem] font-black leading-none text-[var(--foreground)]">
                  {listing.priceLabel}
                </p>
                {listing.isBoosted ? (
                  <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white">
                    Car of the week
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[1.02rem] text-[var(--foreground)]">
                <span>{listing.subcategory}</span>
                <DotDivider />
                <span>{listing.featureBullets[0] ?? listing.condition}</span>
                <DotDivider />
                <span>{listing.condition}</span>
              </div>
            </div>
          </div>

          <Link
            href={href}
            className="line-clamp-2 text-[1.05rem] font-medium uppercase leading-7 tracking-[0.01em] text-[var(--foreground)]"
          >
            {listing.title}
          </Link>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--foreground)]">
            <span className="inline-flex items-center gap-1.5">
              <span>◫</span>
              {listing.featureBullets[1] ?? "2026"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span>◌</span>
              {listing.featureBullets[2] ?? "0 km"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span>⌁</span>
              {listing.featureBullets[3] ?? "Left Hand"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span>◍</span>
              GCC Specs
            </span>
          </div>

          <p className="inline-flex items-center gap-1.5 text-[1rem] text-[var(--foreground)]">
            <span>⌖</span>
            {resolvedLocation}
          </p>

          <div className="grid gap-1 pt-2">
            <p className="text-sm text-[var(--muted)]">Listed by</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[1.1rem] font-black text-[var(--foreground)]">
                {listing.sellerDisplayName ?? "Marketplace seller"}
              </p>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[0.62rem] font-black leading-tight text-[var(--muted)]">
                Seller
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={href}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-rose-50 px-5 text-base font-medium text-[var(--foreground)]"
            >
              <span className="text-rose-500">✆</span>
              Show Phone Number
            </Link>
            <Link
              href={href}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-50 px-5 text-base font-medium text-[var(--foreground)]"
            >
              <span className="text-emerald-600">◔</span>
              WhatsApp
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
  latitude,
  longitude,
  radiusKilometers,
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
    latitude,
    longitude,
    radiusKilometers,
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
      latitude,
      longitude,
      radiusKilometers,
      minPrice,
      maxPrice,
      sort,
      category: selectedCategorySlug ?? "",
      attributeValues,
    });
  }, [
    attributeValues,
    latitude,
    location,
    longitude,
    maxPrice,
    minPrice,
    query,
    radiusKilometers,
    selectedCategorySlug,
    sort,
  ]);

  const resolvedDraftLocation = useResolvedLocationLabel({
    location: draft.location,
    latitude: draft.latitude,
    longitude: draft.longitude,
    fallbackLabel: "Pinned map location",
    compact: true,
  });

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
      latitude != null ||
      longitude != null ||
      radiusKilometers != null ||
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

        if (latitude != null) {
          params.set("centerLatitude", String(latitude));
        }

        if (longitude != null) {
          params.set("centerLongitude", String(longitude));
        }

        if (radiusKilometers != null) {
          params.set("radiusKilometers", String(radiusKilometers));
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
    latitude,
    listings.length,
    location,
    longitude,
    maxPrice,
    minPrice,
    query,
    radiusKilometers,
    selectedCategorySlug,
    sort,
  ]);

  const activeFilterLabels = [
    draft.q.trim() ? `Keyword: ${draft.q.trim()}` : null,
    draft.location.trim()
      ? draft.radiusKilometers != null
        ? `${formatDisplayLocation({
            location: draft.location,
            latitude: draft.latitude,
            longitude: draft.longitude,
            fallbackLabel: "Pinned map location",
          })
            .split(",")[0]
            ?.trim() || "Pinned map location"} · ${draft.radiusKilometers} km`
        : formatDisplayLocation({
            location: draft.location,
            latitude: draft.latitude,
            longitude: draft.longitude,
            fallbackLabel: "Pinned map location",
          })
            .split(",")[0]
            ?.trim() || "Pinned map location"
      : null,
    draft.minPrice.trim() ? `Min price: ${draft.minPrice.trim()}` : null,
    draft.maxPrice.trim() ? `Max price: ${draft.maxPrice.trim()}` : null,
    ...dynamicFields.flatMap((field) => {
      const value = draft.attributeValues[field.key] ?? "";
      return value ? [`${field.label}: ${value}`] : [];
    }),
  ].filter(Boolean) as string[];

  const displayActiveFilterLabels = activeFilterLabels.map((label) =>
    label
      .replaceAll("Pinned map location", resolvedDraftLocation || "Pinned map location")
      .replaceAll("Â·", "·"),
  );

  const visibleListings = resolvedListings;

  const resultTitle = selectedCategory?.name ?? "All listings";

  function buildHref(nextState: SearchDraftState) {
    const params = new URLSearchParams();

    if (nextState.q.trim()) params.set("q", nextState.q.trim());
    if (nextState.category) params.set("category", nextState.category);
    if (nextState.location.trim()) params.set("location", nextState.location.trim());
    if (nextState.latitude != null) params.set("lat", String(nextState.latitude));
    if (nextState.longitude != null) params.set("lng", String(nextState.longitude));
    if (nextState.radiusKilometers != null) {
      params.set("radiusKm", String(nextState.radiusKilometers));
    }
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

  function handleLocationApply(value: LocationRadiusValue) {
    const nextState = {
      ...draft,
      location: value.location,
      latitude: value.latitude,
      longitude: value.longitude,
      radiusKilometers: value.radiusKilometers,
    };
    setDraft(nextState);
    navigate(nextState);
  }

  function clearExtendedFilters() {
    setDraft((current) => ({
      ...current,
      q: "",
      location: "",
      latitude: null,
      longitude: null,
      radiusKilometers: null,
      minPrice: "",
      maxPrice: "",
      attributeValues: {},
    }));
  }

  return (
    <div className="page grid gap-6">
      <section className="grid gap-2 overflow-hidden rounded-[1.65rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_24px_56px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          {categoryTree.map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => handleMainCategorySelect(category.slug)}
              className={`rounded-lg px-4 py-1.5 text-sm font-black whitespace-nowrap ${
                activeMainCategory?.slug === category.slug
                  ? "bg-[var(--brand)] text-white shadow-[0_12px_28px_rgba(109,70,255,0.22)]"
                  : "border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)]"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[1.1rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
          <div className="grid lg:grid-cols-[1fr_1.6fr_1fr_0.95fr_0.95fr_1.2fr]">
            <div className="grid gap-1 border-b border-[var(--line)] px-5 py-3 lg:border-b-0 lg:border-r">
              <span className="text-[0.74rem] font-black text-[var(--foreground)]">
                Location
              </span>
              <LocationRadiusFilter
                value={{
                  location: draft.location,
                  latitude: draft.latitude,
                  longitude: draft.longitude,
                  radiusKilometers: draft.radiusKilometers,
                }}
                onApply={handleLocationApply}
              />
            </div>

            <label className="grid gap-1 border-b border-[var(--line)] px-5 py-3 lg:border-b-0 lg:border-r">
              <span className="text-[0.74rem] font-black text-[var(--foreground)]">
                Subcategory
              </span>
              <select
                value={
                  subcategoryNodes.some((item) => item.slug === draft.category)
                    ? draft.category
                    : ""
                }
                onChange={handleSubcategoryChange}
                className="h-auto border-0 bg-transparent px-0 py-0 text-[1.02rem] text-[var(--foreground)] outline-none"
              >
                <option value="">{activeMainCategory?.name ?? "All"} overview</option>
                {subcategoryNodes.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 border-b border-[var(--line)] px-5 py-3 md:border-r lg:border-b-0">
              <span className="text-[0.74rem] font-black text-[var(--foreground)]">
                Price Range
              </span>
              <input
                value={
                  draft.minPrice || draft.maxPrice
                    ? `${draft.minPrice || "Any"} - ${draft.maxPrice || "Any"}`
                    : ""
                }
                onChange={() => undefined}
                placeholder="Select"
                readOnly
                className="h-auto cursor-pointer border-0 bg-transparent px-0 py-0 text-[1.02rem] text-[var(--foreground)] shadow-none outline-none placeholder:text-[var(--muted)]"
                onClick={() => setDrawerOpen(true)}
              />
            </label>

            <label className="grid gap-1 border-b border-[var(--line)] px-5 py-3 lg:border-b-0 lg:border-r">
              <span className="text-[0.74rem] font-black text-[var(--foreground)]">
                Subcategory
              </span>
              <select
                value={
                  subcategoryNodes.some((item) => item.slug === draft.category)
                    ? draft.category
                    : ""
                }
                onChange={handleSubcategoryChange}
                className="h-auto border-0 bg-transparent px-0 py-0 text-[1.02rem] text-[var(--foreground)] outline-none"
              >
                <option value="">{activeMainCategory?.name ?? "All"} overview</option>
                {subcategoryNodes.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-1 border-b border-[var(--line)] px-5 py-3 md:border-r lg:border-b-0">
              <span className="text-[0.74rem] font-black text-[var(--foreground)]">
                Sort
              </span>
              <select
                value={draft.sort}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sort: event.target.value as SearchDraftState["sort"],
                  }))
                }
                className="h-auto border-0 bg-transparent px-0 py-0 text-[1.02rem] text-[var(--foreground)] outline-none"
              >
                <option value="recommended">Select</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Low to high</option>
                <option value="price_desc">High to low</option>
              </select>
            </div>

            <div className="grid gap-1 px-5 py-3">
              <span className="text-[0.74rem] font-black text-[var(--foreground)]">
                Filters
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex items-center justify-between gap-3 text-left"
              >
                <span className="truncate text-[1.02rem] text-[var(--muted)]">
                  {displayActiveFilterLabels.length
                    ? `${displayActiveFilterLabels.length} active filters`
                    : dynamicFields.length
                      ? `${dynamicFields.length} more filters`
                      : "Keyword, city, etc."}
                </span>
                <span className="text-lg leading-none text-[var(--foreground)]">⌄</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[0.92rem] text-[var(--muted)]">
          <Link href={previewHref("/", customerPreview)} className="font-semibold text-[var(--brand-strong)]">
            Home
          </Link>
          {breadcrumb.map((item) => (
            <span key={item.slug} className="flex items-center gap-1.5">
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

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-[1.7rem] font-black tracking-[-0.03em] text-[var(--foreground)]">
              {resultTitle}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {visibleListings.length} matching listing
              {visibleListings.length === 1 ? "" : "s"}
            </p>
          </div>
          {subcategoryNodes.length ? (
            <div className="flex max-w-full flex-wrap gap-1.5">
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
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-bold ${
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

        {displayActiveFilterLabels.length ? (
          <div className="flex flex-wrap gap-1.5">
            {displayActiveFilterLabels.map((label) => (
              <span
                key={label}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--muted)]"
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
            <SearchResultCardModern
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

              <div className="grid gap-1.5 rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4">
                <span className="text-sm font-bold text-[var(--foreground)]">
                  Location radius
                </span>
                <p className="text-sm text-[var(--foreground)]">
                  {draft.location.trim() || "Anywhere"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {draft.radiusKilometers != null
                    ? `Showing listings within ${draft.radiusKilometers} km of the selected pin. Change it from the top location selector.`
                    : "No radius filter is active. Use the top location selector to choose an exact area on the map."}
                </p>
              </div>

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
