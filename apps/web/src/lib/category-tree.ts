import type { MarketplaceCategory } from "@/lib/marketplace";

export type MarketplaceCategoryNode = MarketplaceCategory & {
  nestedChildren: MarketplaceCategoryNode[];
};

export type FlatMarketplaceCategory = {
  category: MarketplaceCategoryNode;
  depth: number;
};

export function buildMarketplaceCategoryTree(categories: MarketplaceCategory[]) {
  const childrenByParent = new Map<string, MarketplaceCategory[]>();
  const slugs = new Set(categories.map((category) => category.slug));
  const roots: MarketplaceCategory[] = [];

  for (const category of categories) {
    if (category.parentSlug && slugs.has(category.parentSlug)) {
      const children = childrenByParent.get(category.parentSlug) ?? [];
      children.push(category);
      childrenByParent.set(category.parentSlug, children);
    } else {
      roots.push(category);
    }
  }

  function attach(category: MarketplaceCategory): MarketplaceCategoryNode {
    return {
      ...category,
      nestedChildren: (childrenByParent.get(category.slug) ?? []).map(attach),
    };
  }

  return roots.map(attach);
}

export function flattenMarketplaceCategoryTree(
  nodes: MarketplaceCategoryNode[],
  depth = 0
): FlatMarketplaceCategory[] {
  return nodes.flatMap((category) => [
    { category, depth },
    ...flattenMarketplaceCategoryTree(category.nestedChildren, depth + 1),
  ]);
}
