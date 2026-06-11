"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/(main)/actions";
import { AdminSubmitButton } from "@/components/marketplace/admin-form-feedback";
import { CategoryBulkTools } from "@/components/marketplace/category-bulk-tools";
import { CategorySchemaEditor } from "@/components/marketplace/category-schema-editor";
import { type MarketplaceCategory } from "@/lib/marketplace";
import { CategoryForm } from "./category-form";
import { CategoryIcon } from "./category-icon";

type CategoryNode = MarketplaceCategory & {
  nestedChildren: CategoryNode[];
};

type TreeRow = {
  node: CategoryNode;
  depth: number;
};

type StatusFilter = "all" | "active" | "inactive";
type TypeFilter = "all" | "main" | "sub";

function buildCategoryTree(categories: MarketplaceCategory[]): CategoryNode[] {
  const childrenByParent = new Map<string, MarketplaceCategory[]>();
  const categorySlugs = new Set(categories.map((category) => category.slug));
  const roots: MarketplaceCategory[] = [];

  for (const category of categories) {
    if (category.parentSlug && categorySlugs.has(category.parentSlug)) {
      const children = childrenByParent.get(category.parentSlug) ?? [];
      children.push(category);
      childrenByParent.set(category.parentSlug, children);
      continue;
    }

    roots.push(category);
  }

  function attachChildren(
    category: MarketplaceCategory,
    visited = new Set<string>()
  ): CategoryNode {
    if (visited.has(category.slug)) {
      return { ...category, nestedChildren: [] };
    }

    const nextVisited = new Set(visited);
    nextVisited.add(category.slug);

    return {
      ...category,
      nestedChildren: (childrenByParent.get(category.slug) ?? []).map((child) =>
        attachChildren(child, nextVisited)
      ),
    };
  }

  return roots.map((category) => attachChildren(category));
}

function flattenTree(
  nodes: CategoryNode[],
  expandedSlugs: Set<string>,
  forceExpanded: boolean,
  depth = 0
): TreeRow[] {
  return nodes.flatMap((node) => {
    const rows: TreeRow[] = [{ node, depth }];
    const expanded = forceExpanded || expandedSlugs.has(node.slug);

    if (expanded && node.nestedChildren.length) {
      rows.push(
        ...flattenTree(node.nestedChildren, expandedSlugs, forceExpanded, depth + 1)
      );
    }

    return rows;
  });
}

function getExpandableSlugs(nodes: CategoryNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.nestedChildren.length ? [node.slug] : []),
    ...getExpandableSlugs(node.nestedChildren),
  ]);
}

function getDescendantSlugs(
  category: MarketplaceCategory,
  categories: MarketplaceCategory[]
) {
  const descendants = new Set<string>();
  const queue = categories.filter((item) => item.parentSlug === category.slug);

  while (queue.length) {
    const child = queue.shift();

    if (!child || descendants.has(child.slug)) {
      continue;
    }

    descendants.add(child.slug);
    queue.push(...categories.filter((item) => item.parentSlug === child.slug));
  }

  return descendants;
}

function countNodes(nodes: CategoryNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countNodes(node.nestedChildren),
    0
  );
}

function maxDepth(nodes: CategoryNode[], depth = 0): number {
  return nodes.reduce(
    (deepest, node) =>
      Math.max(deepest, depth, maxDepth(node.nestedChildren, depth + 1)),
    depth
  );
}

function getCategoryPath(
  category: MarketplaceCategory,
  categories: MarketplaceCategory[]
) {
  const path = [category.name];
  let parentSlug = category.parentSlug;
  const seen = new Set<string>([category.slug]);

  while (parentSlug && !seen.has(parentSlug)) {
    const parent = categories.find((item) => item.slug === parentSlug);

    if (!parent) {
      break;
    }

    path.unshift(parent.name);
    seen.add(parent.slug);
    parentSlug = parent.parentSlug;
  }

  return path.join(" / ");
}

function matchesCategory(
  category: MarketplaceCategory,
  query: string,
  statusFilter: StatusFilter,
  typeFilter: TypeFilter
) {
  const normalizedQuery = query.trim().toLowerCase();
  const searchable =
    `${category.name} ${category.slug} ${category.description}`.toLowerCase();
  const queryMatches = !normalizedQuery || searchable.includes(normalizedQuery);
  const statusMatches =
    statusFilter === "all" ||
    (statusFilter === "active" && category.isActive) ||
    (statusFilter === "inactive" && !category.isActive);
  const typeMatches =
    typeFilter === "all" ||
    (typeFilter === "main" && !category.parentSlug) ||
    (typeFilter === "sub" && Boolean(category.parentSlug));

  return queryMatches && statusMatches && typeMatches;
}

function filterCategoryTree(
  nodes: CategoryNode[],
  query: string,
  statusFilter: StatusFilter,
  typeFilter: TypeFilter
): CategoryNode[] {
  return nodes.flatMap((node) => {
    const filteredChildren = filterCategoryTree(
      node.nestedChildren,
      query,
      statusFilter,
      typeFilter
    );
    const selfMatches = matchesCategory(node, query, statusFilter, typeFilter);

    if (!selfMatches && !filteredChildren.length) {
      return [];
    }

    return [{ ...node, nestedChildren: filteredChildren }];
  });
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
          : "bg-[#f7e8e3] text-[#9f321e]"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-[var(--brand)] text-white"
          : "border border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--brand)]"
      }`}
    >
      {children}
    </button>
  );
}

function CategoryTreeRow({
  row,
  selected,
  expanded,
  onSelect,
  onToggle,
  onAddSubcategory,
  canEdit,
}: {
  row: TreeRow;
  selected: boolean;
  expanded: boolean;
  onSelect: (category: MarketplaceCategory) => void;
  onToggle: (slug: string) => void;
  onAddSubcategory: (category: MarketplaceCategory) => void;
  canEdit: boolean;
}) {
  const { node, depth } = row;
  const hasChildren = node.nestedChildren.length > 0;

  return (
    <div
      className={`grid min-w-[54rem] grid-cols-[minmax(20rem,1fr)_8rem_7rem_6rem_7rem_10rem] items-center gap-3 border-b border-[var(--line)] px-4 py-2 text-sm last:border-b-0 ${
        selected ? "bg-[var(--brand-soft)]" : "bg-white hover:bg-[#fbfcfa]"
      }`}
    >
      <div
        className="flex min-w-0 items-center gap-2"
        style={{ paddingLeft: `${Math.min(depth, 6) * 1.35}rem` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.slug)}
          disabled={!hasChildren}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border text-xs font-bold ${
            hasChildren
              ? "border-[var(--line)] text-[var(--foreground)] hover:border-[var(--brand)]"
              : "border-transparent text-transparent"
          }`}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "-" : "+"}
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--foreground)]">
          <CategoryIcon slug={node.slug} className="h-4 w-4" />
        </div>
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="min-w-0 text-left"
        >
          <span className="block truncate font-semibold text-[var(--foreground)]">
            {node.name}
          </span>
          <span className="block truncate text-xs text-[var(--muted)]">
            /{node.slug}
          </span>
        </button>
      </div>

      <span className="rounded-md border border-[var(--line)] px-2 py-1 text-center text-xs font-semibold text-[var(--muted)]">
        {node.parentSlug ? `Level ${depth + 1}` : "Main"}
      </span>
      <StatusBadge active={node.isActive} />
      <span className="text-sm font-semibold text-[var(--foreground)]">
        {node.nestedChildren.length}
      </span>
      <span className="text-xs font-semibold text-[var(--muted)]">
        {node.schema.length} fields
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
        >
          {canEdit ? "Edit" : "View"}
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={() => onAddSubcategory(node)}
            className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--brand-strong)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            Add child
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SelectedCategoryPanel({
  category,
  categories,
  onAddSubcategory,
  onClose,
  canEdit,
  returnTo,
}: {
  category?: MarketplaceCategory;
  categories: MarketplaceCategory[];
  onAddSubcategory: (category: MarketplaceCategory) => void;
  onClose: () => void;
  canEdit: boolean;
  returnTo: string;
}) {
  if (!category) {
    return null;
  }

  const blockedParentSlugs = getDescendantSlugs(category, categories);
  blockedParentSlugs.add(category.slug);
  const parentOptions = categories.filter(
    (option) => !blockedParentSlugs.has(option.slug)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 py-8 backdrop-blur-[2px]">
      <div className="max-h-[calc(100vh-4rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--foreground)]">
              <CategoryIcon slug={category.slug} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-[var(--foreground)]">
                  {category.name}
                </h3>
                <StatusBadge active={category.isActive} />
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {getCategoryPath(category, categories)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                Listings expire after {category.listingExpiryDays} days.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--foreground)]"
          >
            Close
          </button>
        </div>

        {canEdit ? (
          <form action={updateCategoryAction} className="admin-form-card mt-5">
            <input type="hidden" name="slug" value={category.slug} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="admin-form-section">
              <div className="admin-form-section-head">
                <h3 className="admin-form-section-title">Category settings</h3>
                <p className="admin-form-section-copy">
                  Update naming, parent placement, active state, and listing expiry.
                </p>
              </div>
              <div className="admin-form-grid md:grid-cols-2">
                <label className="admin-field">
                  <span className="admin-field-label">Name</span>
                  <input
                    name="name"
                    defaultValue={category.name}
                    className="surface-input text-sm"
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Parent</span>
                  <select
                    name="parentSlug"
                    defaultValue={category.parentSlug ?? ""}
                    className="surface-input text-sm"
                  >
                    <option value="">Top-level</option>
                    {parentOptions.map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {getCategoryPath(option, categories)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field md:col-span-2">
                  <span className="admin-field-label">Description</span>
                  <textarea
                    name="description"
                    defaultValue={category.description}
                    rows={4}
                    className="surface-input min-h-24 resize-none text-sm"
                  />
                </label>
                <label className="admin-field md:col-span-2">
                  <span className="admin-field-label">Category image URL</span>
                  <input
                    name="imageUrl"
                    defaultValue={category.imageUrl}
                    placeholder="https://images.example.com/category.jpg"
                    className="surface-input text-sm"
                  />
                  <p className="admin-field-help">
                    Shown on the marketplace home page category cards.
                  </p>
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Status</span>
                  <select
                    name="isActive"
                    defaultValue={String(category.isActive)}
                    className="surface-input text-sm"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span className="admin-field-label">Listing expiry days</span>
                  <input
                    name="listingExpiryDays"
                    type="number"
                    min="1"
                    max="365"
                    defaultValue={category.listingExpiryDays}
                    className="surface-input text-sm"
                  />
                </label>
              </div>
            </div>

            <CategorySchemaEditor
              key={`edit-schema-${category.slug}`}
              initialFields={category.schema}
              inheritedFields={
                category.parentSlug
                  ? (categories.find((item) => item.slug === category.parentSlug)
                      ?.schema ?? [])
                  : []
              }
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <AdminSubmitButton
                className="action-primary px-4 py-2 text-sm font-semibold"
                pendingText="Saving category..."
              >
                Save
              </AdminSubmitButton>
              <button
                type="button"
                onClick={() => onAddSubcategory(category)}
                className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--brand-strong)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
              >
                Add child
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 rounded-md border border-[var(--line)] p-4 text-sm text-[var(--muted)]">
            This role can view catalog details but cannot edit categories.
          </div>
        )}

        {canEdit && category.isActive ? (
          <form action={deleteCategoryAction} className="mt-3">
            <input type="hidden" name="slug" value={category.slug} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <AdminSubmitButton
              className="w-full rounded-md border border-[#e7b6a9] px-4 py-2 text-sm font-semibold text-[#9f321e] hover:bg-[#fff3ef]"
              confirmMessage={`Disable "${category.name}"? This can affect category visibility and listing placement.`}
              pendingText="Disabling category..."
            >
              Disable category
            </AdminSubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function CategoryManagement({
  categories,
  canEdit = true,
  returnTo = "/admin/categories",
  initialTypeFilter = "all",
  initialCreateMode = "main",
}: {
  categories: MarketplaceCategory[];
  canEdit?: boolean;
  returnTo?: string;
  initialTypeFilter?: TypeFilter;
  initialCreateMode?: "main" | "sub";
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(initialTypeFilter);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(() => {
    const tree = buildCategoryTree(categories);
    return new Set(getExpandableSlugs(tree));
  });
  const [presetParent, setPresetParent] = useState<{
    slug: string;
    version: number;
  }>();

  const activeCategories = categories.filter((category) => category.isActive);
  const subcategories = categories.filter((category) => category.parentSlug);
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const allExpandableSlugs = useMemo(
    () => getExpandableSlugs(categoryTree),
    [categoryTree]
  );
  const filteredTree = useMemo(
    () => filterCategoryTree(categoryTree, query, statusFilter, typeFilter),
    [categoryTree, query, statusFilter, typeFilter]
  );
  const forceExpanded = Boolean(query.trim()) || statusFilter !== "all" || typeFilter !== "all";
  const visibleRows = useMemo(
    () => flattenTree(filteredTree, expandedSlugs, forceExpanded),
    [expandedSlugs, filteredTree, forceExpanded]
  );
  const selectedCategory =
    categories.find((category) => category.slug === selectedSlug) ?? undefined;
  const treeDepth = maxDepth(categoryTree);
  const resultCount = countNodes(filteredTree);

  function startSubcategory(category: MarketplaceCategory) {
    setPresetParent({ slug: category.slug, version: Date.now() });
    window.requestAnimationFrame(() => {
      document
        .getElementById("category-create-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleExpanded(slug: string) {
    setExpandedSlugs((current) => {
      const next = new Set(current);

      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }

      return next;
    });
  }

  return (
    <section className="grid gap-4">
      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <div className="admin-form-section-head">
          <h2 className="text-xl font-semibold">Category Management</h2>
          <p className="admin-form-section-copy">
            {categories.length} categories across {treeDepth + 1} levels.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <span className="admin-page-header-badge">
            {categories.length} total
          </span>
          <span className="admin-page-header-badge">
            {activeCategories.length} active
          </span>
          <span className="admin-page-header-badge">
            {subcategories.length} child categories
          </span>
        </div>
      </div>

      <div className="grid gap-4">
          <CategoryBulkTools
            canEdit={canEdit}
            categories={categories}
            returnTo={returnTo}
          />
          {canEdit ? (
            <CategoryForm
              key={presetParent?.version ?? "category-root-form"}
              categories={categories}
              presetParentSlug={presetParent?.slug}
              returnTo={returnTo}
              initialMode={initialCreateMode}
            />
          ) : (
            <div className="rounded-md border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)] shadow-sm">
              This role can view categories but cannot create or change them.
            </div>
          )}

          <div className="admin-form-section">
            <div className="admin-form-section-head">
              <h3 className="admin-form-section-title">Find and filter</h3>
              <p className="admin-form-section-copy">
                Narrow the category tree before editing a branch.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="admin-field">
                <span className="admin-field-label">Find category</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, slug, or description"
                  className="surface-input text-sm"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedSlugs(new Set(allExpandableSlugs))}
                  className="action-secondary px-3 py-2 text-sm font-semibold"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedSlugs(new Set())}
                  className="action-secondary px-3 py-2 text-sm font-semibold"
                >
                  Collapse all
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <FilterButton
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              >
                All status
              </FilterButton>
              <FilterButton
                active={statusFilter === "active"}
                onClick={() => setStatusFilter("active")}
              >
                Active
              </FilterButton>
              <FilterButton
                active={statusFilter === "inactive"}
                onClick={() => setStatusFilter("inactive")}
              >
                Inactive
              </FilterButton>
              <FilterButton
                active={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
              >
                All levels
              </FilterButton>
              <FilterButton
                active={typeFilter === "main"}
                onClick={() => setTypeFilter("main")}
              >
                Main only
              </FilterButton>
              <FilterButton
                active={typeFilter === "sub"}
                onClick={() => setTypeFilter("sub")}
              >
                Child only
              </FilterButton>
            </div>

            <p className="mt-3 text-sm text-[var(--muted)]">
              Showing {resultCount} of {categories.length} categories.
            </p>
          </div>

          <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="grid min-w-[54rem] grid-cols-[minmax(20rem,1fr)_8rem_7rem_6rem_7rem_10rem] gap-3 border-b border-[var(--line)] bg-[#fbfcfa] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                <span>Category tree</span>
                <span>Level</span>
                <span>Status</span>
                <span>Children</span>
                <span>Fields</span>
                <span>Actions</span>
              </div>

              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <CategoryTreeRow
                    key={row.node.slug}
                    row={row}
                    selected={row.node.slug === selectedCategory?.slug}
                    expanded={forceExpanded || expandedSlugs.has(row.node.slug)}
                    onSelect={(category) => setSelectedSlug(category.slug)}
                    onToggle={toggleExpanded}
                    onAddSubcategory={startSubcategory}
                    canEdit={canEdit}
                  />
                ))
              ) : (
                <div className="px-5 py-8 text-center text-sm text-[var(--muted)]">
                  No categories match the current filters.
                </div>
              )}
            </div>
          </div>
      </div>

      <SelectedCategoryPanel
        category={selectedCategory}
        categories={categories}
        onAddSubcategory={startSubcategory}
        onClose={() => setSelectedSlug("")}
        canEdit={canEdit}
        returnTo={returnTo}
      />
    </section>
  );
}
