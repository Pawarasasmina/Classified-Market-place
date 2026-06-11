"use client";

import {
  useActionState,
  useMemo,
  useState,
} from "react";
import { createCategoryAction } from "@/app/(main)/actions";
import { CategorySchemaEditor } from "@/components/marketplace/category-schema-editor";
import {
  type AttributeField,
  type FormActionState,
  type MarketplaceCategory,
} from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

function fieldMessage(state: FormActionState, field: string) {
  return state.fieldErrors?.[field] ? (
    <p className="text-sm text-[#9f321e]">{state.fieldErrors[field]}</p>
  ) : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildChildrenByParent(categories: MarketplaceCategory[]) {
  const childrenByParent = new Map<string, MarketplaceCategory[]>();

  for (const category of categories) {
    const parentKey = category.parentSlug ?? "";
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  }

  return childrenByParent;
}

function getParentPath(slug: string, categories: MarketplaceCategory[]) {
  const categoryBySlug = new Map(
    categories.map((category) => [category.slug, category])
  );
  const path: string[] = [];
  let current = categoryBySlug.get(slug);
  const visited = new Set<string>();

  while (current && !visited.has(current.slug)) {
    path.unshift(current.slug);
    visited.add(current.slug);
    current = current.parentSlug
      ? categoryBySlug.get(current.parentSlug)
      : undefined;
  }

  return path;
}

function formatPath(path: string[], categories: MarketplaceCategory[]) {
  const categoryBySlug = new Map(
    categories.map((category) => [category.slug, category])
  );

  return path
    .map((slug) => categoryBySlug.get(slug)?.name)
    .filter(Boolean)
    .join(" / ");
}

export function CategoryForm({
  categories,
  presetParentSlug,
  returnTo = "/admin/categories",
  initialMode,
}: {
  categories: MarketplaceCategory[];
  presetParentSlug?: string;
  returnTo?: string;
  initialMode?: "main" | "sub";
}) {
  const [state, formAction, pending] = useActionState(
    createCategoryAction,
    initialState
  );
  const [mode, setMode] = useState<"main" | "sub">(
    initialMode ?? (presetParentSlug ? "sub" : "main")
  );
  const [parentPath, setParentPath] = useState<string[]>(
    presetParentSlug ? getParentPath(presetParentSlug, categories) : []
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [listingExpiryDays, setListingExpiryDays] = useState(
    presetParentSlug ? "30" : "30"
  );

  const childrenByParent = useMemo(
    () => buildChildrenByParent(categories),
    [categories]
  );
  const suggestedSlug = useMemo(() => slugify(name), [name]);
  const selectedParentSlug = parentPath[parentPath.length - 1] ?? "";
  const selectedParentPath = formatPath(parentPath, categories);
  const parentSelectors = useMemo(() => {
    const selectors: {
      key: string;
      level: number;
      options: MarketplaceCategory[];
      value: string;
    }[] = [];
    let parentKey = "";

    for (let level = 0; ; level += 1) {
      const options = childrenByParent.get(parentKey) ?? [];

      if (!options.length) {
        break;
      }

      const value = parentPath[level] ?? "";
      selectors.push({
        key: parentKey || "root",
        level,
        options,
        value,
      });

      if (!value) {
        break;
      }

      parentKey = value;
    }

    return selectors;
  }, [childrenByParent, parentPath]);
  const inheritedSchema = useMemo<AttributeField[]>(() => {
    if (!selectedParentSlug) {
      return [];
    }

    return (
      categories.find((category) => category.slug === selectedParentSlug)?.schema ??
      []
    ).map((field) => ({ ...field }));
  }, [categories, selectedParentSlug]);

  return (
    <form
      id="category-create-form"
      action={formAction}
      className="panel admin-form-card scroll-mt-6"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="admin-form-section-head">
          <p className="admin-form-section-title">Add category or subcategory</p>
          <p className="admin-form-section-copy">
            Choose the level first, then define the public copy and dynamic
            listing questions.
          </p>
        </div>
        <span className="admin-page-header-badge">
          {categories.length} total
        </span>
      </div>

      <div className="inline-grid w-fit grid-cols-2 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setMode("main");
            setParentPath([]);
          }}
          className={`rounded px-4 py-2 ${
            mode === "main"
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "text-[var(--muted)]"
          }`}
        >
          Main category
        </button>
        <button
          type="button"
          onClick={() => setMode("sub")}
          className={`rounded px-4 py-2 ${
            mode === "sub"
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "text-[var(--muted)]"
          }`}
        >
          Subcategory
        </button>
      </div>

      {mode === "sub" && selectedParentPath ? (
        <p className="mt-3 rounded-md bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]">
          New category will be added under {selectedParentPath}.
        </p>
      ) : null}

      <div className="admin-form-section">
        <div className="admin-form-section-head">
          <h3 className="admin-form-section-title">Basic details</h3>
          <p className="admin-form-section-copy">
            These values control the category label, URL, and listing expiry.
          </p>
        </div>
        <div className="admin-form-grid md:grid-cols-2">
        <label className="admin-field">
          <span className="admin-field-label">Name</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Vehicles"
            className="surface-input text-sm"
          />
          {fieldMessage(state, "name")}
        </label>

        <label className="admin-field">
          <span className="admin-field-label">URL slug</span>
          <input
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={suggestedSlug || "auto-generated"}
            className="surface-input text-sm"
          />
          <p className="admin-field-help">
            Leave blank to generate from the category name.
          </p>
          {fieldMessage(state, "slug")}
        </label>

        <label className="admin-field md:col-span-2">
          <span className="admin-field-label">Description</span>
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Short description shown to buyers"
            className="surface-input min-h-24 resize-none text-sm"
          />
          {fieldMessage(state, "description")}
        </label>

        <label className="admin-field">
          <span className="admin-field-label">Listing expiry days</span>
          <input
            name="listingExpiryDays"
            type="number"
            min="1"
            max="365"
            value={listingExpiryDays}
            onChange={(event) => setListingExpiryDays(event.target.value)}
            className="surface-input text-sm"
          />
          <p className="admin-field-help">
            Listings in this category expire after this many days once active.
          </p>
          {fieldMessage(state, "listingExpiryDays")}
        </label>

        {mode === "sub" ? (
          <div className="grid gap-3 md:col-span-2">
            <input type="hidden" name="parentSlug" value={selectedParentSlug} />
            <div className="grid gap-4 md:grid-cols-2">
              {parentSelectors.map(({ key, level, options, value }) => (
                <label key={key} className="admin-field">
                  <span className="admin-field-label">
                    {level === 0
                      ? "Parent category"
                      : level === 1
                        ? "Subcategory"
                        : `Level ${level + 1} category`}
                  </span>
                  <select
                    value={value}
                    required={level === 0}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const nextPath = parentPath.slice(0, level);

                      if (nextValue) {
                        nextPath.push(nextValue);
                      }

                      setParentPath(nextPath);
                    }}
                    className="surface-input text-sm"
                  >
                    <option value="">
                      {level === 0 ? "Choose parent category" : "Add directly here"}
                    </option>
                    {options.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]">
              Choose only the first dropdown to create a subcategory. Choose the
              second dropdown to create a sub-subcategory under that subcategory.
            </p>
            {fieldMessage(state, "parentSlug")}
          </div>
        ) : (
          <input type="hidden" name="parentSlug" value="" />
        )}
        </div>
      </div>

      <CategorySchemaEditor
        key={`create-schema-${selectedParentSlug || "root"}`}
        inheritedFields={inheritedSchema}
      />

        <div className="admin-form-actions">
          <button
            disabled={pending}
            className="action-primary w-full px-4 py-2 text-sm font-semibold disabled:opacity-60 md:w-fit"
          >
            {pending
              ? "Saving..."
              : mode === "sub"
                ? "Add subcategory"
                : "Add main category"}
          </button>
        </div>

      {state.message ? (
        <p className="mt-4 rounded-md border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
