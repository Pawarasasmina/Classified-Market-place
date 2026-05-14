"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/(main)/actions";
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
}: {
  row: TreeRow;
  selected: boolean;
  expanded: boolean;
  onSelect: (category: MarketplaceCategory) => void;
  onToggle: (slug: string) => void;
  onAddSubcategory: (category: MarketplaceCategory) => void;
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
          Edit
        </button>
        <button
          type="button"
          onClick={() => onAddSubcategory(node)}
          className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--brand-strong)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
        >
          Add child
        </button>
      </div>
    </div>
  );
}

function SelectedCategoryPanel({
  category,
  categories,
  onAddSubcategory,
}: {
  category?: MarketplaceCategory;
  categories: MarketplaceCategory[];
  onAddSubcategory: (category: MarketplaceCategory) => void;
}) {
  if (!category) {
    return (
      <aside className="rounded-md border border-dashed border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">
        Select a category from the tree.
      </aside>
    );
  }

  const blockedParentSlugs = getDescendantSlugs(category, categories);
  blockedParentSlugs.add(category.slug);
  const parentOptions = categories.filter(
    (option) => !blockedParentSlugs.has(option.slug)
  );

  return (
    <aside className="rounded-md border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--foreground)]">
          <CategoryIcon slug={category.slug} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[var(--foreground)]">{category.name}</h3>
            <StatusBadge active={category.isActive} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {getCategoryPath(category, categories)}
          </p>
        </div>
      </div>

      <form action={updateCategoryAction} className="mt-5 grid gap-4">
        <input type="hidden" name="slug" value={category.slug} />
        <input type="hidden" name="returnTo" value="/admin/categories" />
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Name
          </span>
          <input
            name="name"
            defaultValue={category.name}
            className="rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Description
          </span>
          <textarea
            name="description"
            defaultValue={category.description}
            rows={4}
            className="resize-none rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Parent
          </span>
          <select
            name="parentSlug"
            defaultValue={category.parentSlug ?? ""}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          >
            <option value="">Top-level</option>
            {parentOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {getCategoryPath(option, categories)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Status
          </span>
          <select
            name="isActive"
            defaultValue={String(category.isActive)}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button className="action-primary px-4 py-2 text-sm font-semibold">
            Save
          </button>
          <button
            type="button"
            onClick={() => onAddSubcategory(category)}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--brand-strong)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            Add child
          </button>
        </div>
      </form>

      {category.isActive ? (
        <form action={deleteCategoryAction} className="mt-3">
          <input type="hidden" name="slug" value={category.slug} />
          <input type="hidden" name="returnTo" value="/admin/categories" />
          <button className="w-full rounded-md border border-[#e7b6a9] px-4 py-2 text-sm font-semibold text-[#9f321e] hover:bg-[#fff3ef]">
            Disable category
          </button>
        </form>
      ) : null}
    </aside>
  );
}

export function CategoryManagement({
  categories,
}: {
  categories: MarketplaceCategory[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedSlug, setSelectedSlug] = useState(categories[0]?.slug ?? "");
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
    categories.find((category) => category.slug === selectedSlug) ??
    categories[0];
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Category Management</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {categories.length} categories across {treeDepth + 1} levels.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
            {categories.length} total
          </span>
          <span className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
            {activeCategories.length} active
          </span>
          <span className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
            {subcategories.length} child categories
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="grid gap-4">
          <CategoryForm
            key={presetParent?.version ?? "category-root-form"}
            categories={categories}
            presetParentSlug={presetParent?.slug}
          />

          <div className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Find category
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, slug, or description"
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedSlugs(new Set(allExpandableSlugs))}
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:border-[var(--brand)]"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedSlugs(new Set())}
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:border-[var(--brand)]"
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

        <div className="xl:sticky xl:top-4">
          <SelectedCategoryPanel
            category={selectedCategory}
            categories={categories}
            onAddSubcategory={startSubcategory}
          />
        </div>
      </div>
    </section>
  );
}
