import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalog.service";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { PublicCategoryTreeResponse } from "@/api/types/catalog-taxonomy";

/** Root → … → selected category, or [] when the id isn't in the tree. */
export function categoryPath(tree: PublicCategoryTreeResponse[], id: string): PublicCategoryTreeResponse[] {
  for (const node of tree) {
    if (node.categoryId === id) return [node];
    const sub = categoryPath(node.children ?? [], id);
    if (sub.length) return [node, ...sub];
  }
  return [];
}

/**
 * Filter options that don't depend on search results: the public category tree, and for the selected category its
 * effective attributes (with options), brands and conditions (GET /catalog/categories/{id}/listing-requirements,
 * anonymous). Search facets add counts on top when results exist.
 */
export function useFilterOptions(categoryId: string) {
  const tree = useQuery({
    queryKey: ["catalog", "tree"],
    queryFn: ({ signal }) => catalogService.categoryTree(signal),
    staleTime: 10 * 60_000,
  });
  const requirements = useQuery({
    queryKey: ["catalog", "listing-requirements", categoryId],
    queryFn: ({ signal }) => sellerListingsService.listingRequirements(categoryId, signal),
    enabled: !!categoryId,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const nodes = tree.data ?? [];
  return { tree: nodes, path: categoryId ? categoryPath(nodes, categoryId) : [], requirements: requirements.data };
}
