import type { QueryClient } from "@tanstack/react-query";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { ListingDetailResponse, ListingInventoryResponse } from "@/api/types/seller-listings";
import { isInventoryConflict, isVersionConflict } from "./errors";
import { listingFormFromVersion, listingPayload } from "./listing-form";
import { patchListingRowVersion, sellerKeys } from "./queries";

/**
 * Price change on a draft without opening the editor. The update PUT is a full replacement, so the payload is
 * rebuilt from the freshly read draft version with only the price changed.
 */
export async function setDraftPrice(qc: QueryClient, sellerId: string, listingId: string, price: number | ((current: number) => number)): Promise<number> {
  const key = sellerKeys.detail(sellerId, listingId);
  try {
    const detail = await qc.fetchQuery({ queryKey: key, queryFn: ({ signal }) => sellerListingsService.detail(sellerId, listingId, signal), staleTime: 0 });
    const draft = detail.currentDraftVersion;
    if (detail.status !== "DRAFT" || !draft) throw new Error("Only drafts can be repriced. Live listings change through a new draft.");
    const basePrice = Math.round((typeof price === "function" ? price(draft.basePrice) : price) * 100) / 100;
    if (!(basePrice >= 0)) throw new Error("The price can't be below 0.");
    const body = { ...listingPayload({ ...listingFormFromVersion(draft, detail.expiresAtUtc), basePrice: String(basePrice) }, draft.categoryId), expectedRowVersion: detail.rowVersion };
    const { rowVersion } = await sellerListingsService.update(sellerId, listingId, body);
    qc.setQueryData<ListingDetailResponse>(key, (d) => (d && d.currentDraftVersion ? { ...d, currentDraftVersion: { ...d.currentDraftVersion, basePrice } } : d));
    patchListingRowVersion(qc, sellerId, listingId, rowVersion);
    return basePrice;
  } catch (error) {
    if (isVersionConflict(error)) await qc.invalidateQueries({ queryKey: key });
    throw error;
  }
}

/** Sets the on-hand quantity (first entry or a correction) from the card. */
export async function setStock(qc: QueryClient, sellerId: string, listingId: string, onHandQuantity: number): Promise<ListingInventoryResponse> {
  const key = sellerKeys.inventory(sellerId, listingId);
  try {
    const inv = await qc.fetchQuery({ queryKey: key, queryFn: ({ signal }) => sellerListingsService.inventory(sellerId, listingId, signal), staleTime: 0 });
    if (onHandQuantity < inv.reservedQuantity) throw new Error(`Can't be below the ${inv.reservedQuantity} reserved by buyers.`);
    const res = await sellerListingsService.setInventory(sellerId, listingId, { expectedRowVersion: inv.rowVersion, onHandQuantity, reasonCode: inv.rowVersion ? "STOCK_COUNT" : null });
    qc.setQueryData(key, res);
    return res;
  } catch (error) {
    if (isInventoryConflict(error)) await qc.invalidateQueries({ queryKey: key });
    throw error;
  }
}
