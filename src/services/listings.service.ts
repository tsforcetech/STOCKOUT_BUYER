import { http } from "@/lib/api/client";
import type { PublicListingDetailResponse } from "@/api/types/seller-listings";

/** Public listing detail (anonymous). Bare DTO; 410 when suspended/expired. Contract: docs/contracts/seller-listings.md */
export const listingsService = {
  publicDetail: (listingId: string, signal?: AbortSignal) =>
    http.get<PublicListingDetailResponse>(`/api/v1/catalog/listings/${encodeURIComponent(listingId)}`, { signal, auth: false }),
};
