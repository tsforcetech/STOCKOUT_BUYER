import * as React from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useSellerMode } from "@/lib/seller/seller-context";
import { catalogService, flattenCategories } from "@/services/catalog.service";
import { filesService } from "@/services/files.service";
import { marketplaceService } from "@/services/marketplace.service";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { SellerContextResponse } from "@/api/types/user-organization";
import type { ListingAttributesResponse, ListingDetailResponse, ListingMediaResponse, SellerListingListQuery } from "@/api/types/seller-listings";

export const sellerKeys = {
  seller: (sellerId: string) => ["seller", sellerId, "account"] as const,
  documents: (sellerId: string) => ["seller", sellerId, "documents"] as const,
  eligibility: (sellerId: string) => ["seller", sellerId, "eligibility"] as const,
  listings: (sellerId: string) => ["seller", sellerId, "listings"] as const,
  listingList: (sellerId: string, query: SellerListingListQuery) => ["seller", sellerId, "listings", "list", query] as const,
  listing: (sellerId: string, listingId: string) => ["seller", sellerId, "listings", "item", listingId] as const,
  detail: (sellerId: string, listingId: string) => ["seller", sellerId, "listings", "item", listingId, "detail"] as const,
  attributes: (sellerId: string, listingId: string) => ["seller", sellerId, "listings", "item", listingId, "attributes"] as const,
  media: (sellerId: string, listingId: string) => ["seller", sellerId, "listings", "item", listingId, "media"] as const,
  inventory: (sellerId: string, listingId: string) => ["seller", sellerId, "listings", "item", listingId, "inventory"] as const,
  movements: (sellerId: string, listingId: string, page: number, pageSize: number) =>
    ["seller", sellerId, "listings", "item", listingId, "movements", page, pageSize] as const,
  moderation: (sellerId: string, listingId: string) => ["seller", sellerId, "listings", "item", listingId, "moderation"] as const,
  inspections: (sellerId: string, listingId: string, page: number) => ["seller", sellerId, "listings", "item", listingId, "inspections", page] as const,
  latestInspection: (sellerId: string, listingId: string) => ["seller", sellerId, "listings", "item", listingId, "inspection-latest"] as const,
};

export const taxonomyKeys = {
  tree: ["catalog", "tree"] as const,
  requirements: (categoryId: string) => ["catalog", "listing-requirements", categoryId] as const,
};

/** The seller the portal is operating. Only call below <RequireSeller>, which guarantees one exists. */
export function useActiveSeller(): SellerContextResponse {
  const { activeSeller } = useSellerMode();
  if (!activeSeller) throw new Error("useActiveSeller must be used below <RequireSeller>.");
  return activeSeller;
}

export function useSellerAccount(sellerId: string) {
  return useQuery({ queryKey: sellerKeys.seller(sellerId), queryFn: ({ signal }) => marketplaceService.seller(sellerId, signal) });
}

/** GET /sellers/{id}/eligibility — whether listings can go live (canList) and why not. */
export function useSellerEligibility(sellerId: string) {
  return useQuery({ queryKey: sellerKeys.eligibility(sellerId), queryFn: ({ signal }) => marketplaceService.eligibility(sellerId, signal), staleTime: 60_000 });
}

export function useListingDetail(sellerId: string, listingId: string) {
  return useQuery({ queryKey: sellerKeys.detail(sellerId, listingId), queryFn: ({ signal }) => sellerListingsService.detail(sellerId, listingId, signal) });
}

export function useCategoryTree() {
  return useQuery({ queryKey: taxonomyKeys.tree, queryFn: ({ signal }) => catalogService.categoryTree(signal), staleTime: 10 * 60_000 });
}

export interface CategoryEntry {
  categoryId: string;
  name: string;
  path: string[];
  depth: number;
  isLeaf: boolean;
}

/** id → category name/path lookup built from the public tree. */
export function useCategoryIndex() {
  const tree = useCategoryTree();
  const index = React.useMemo(() => {
    const map = new Map<string, CategoryEntry>();
    for (const c of flattenCategories(tree.data ?? [])) {
      map.set(c.categoryId, { categoryId: c.categoryId, name: c.name, path: c.path, depth: c.depth, isLeaf: (c.children ?? []).length === 0 });
    }
    return map;
  }, [tree.data]);
  return { ...tree, index };
}

export function useListingRequirements(categoryId: string | null | undefined) {
  return useQuery({
    queryKey: taxonomyKeys.requirements(categoryId ?? ""),
    queryFn: ({ signal }) => sellerListingsService.listingRequirements(categoryId as string, signal),
    enabled: !!categoryId,
    staleTime: 5 * 60_000,
  });
}

/** Owner-scoped presigned download URL for the caller's own file. */
export function useDownloadUrl(fileId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["files", "download-url", fileId ?? ""],
    queryFn: () => filesService.downloadUrl(fileId as string),
    enabled: !!fileId && enabled,
    staleTime: 4 * 60_000,
    retry: 1,
  });
}

/**
 * Every listing mutation returns a new LISTING rowVersion shared by detail, attributes and media (§1.6).
 * Patch all cached copies so the next mutation (from any tab) sends the latest token.
 */
export function patchListingRowVersion(qc: QueryClient, sellerId: string, listingId: string, rowVersion: string) {
  qc.setQueryData<ListingDetailResponse>(sellerKeys.detail(sellerId, listingId), (d) => (d ? { ...d, rowVersion } : d));
  qc.setQueryData<ListingAttributesResponse>(sellerKeys.attributes(sellerId, listingId), (d) => (d ? { ...d, rowVersion } : d));
  qc.setQueryData<ListingMediaResponse>(sellerKeys.media(sellerId, listingId), (d) => (d ? { ...d, rowVersion } : d));
}
