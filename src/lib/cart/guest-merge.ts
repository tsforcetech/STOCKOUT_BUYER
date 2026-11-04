import type { BuyerCartResponse, GuestCartItemDto, MergeGuestCartRequest } from "@/api/types/buyer-commerce";
import { buyerCommerceService } from "@/services/buyer-commerce.service";
import { listingsService } from "@/services/listings.service";
import type { CartItem } from "./cart-context";
import { newId } from "@/lib/utils/id";

/**
 * One logical guest-cart merge: its Idempotency-Key and its frozen payload. Persisted so a retry after a timeout
 * (even after a reload) resends exactly the same key and body. Removed only after a successful merge.
 */
export interface PendingMerge {
  key: string;
  payload: MergeGuestCartRequest;
  createdAtUtc: string;
}

const KEY = "stockout.market.cart.merge";

export function readPendingMerge(): PendingMerge | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as PendingMerge | null;
    return v && typeof v.key === "string" && Array.isArray(v.payload?.items) ? v : null;
  } catch {
    return null;
  }
}

function writePendingMerge(p: PendingMerge | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export const clearPendingMerge = () => writePendingMerge(null);

/** 8–100 chars of [A-Za-z0-9._-] (BuyerCartController.IsValidIdempotencyKey). */
export function newIdempotencyKey(): string {
  return `guest-merge-${newId()}`;
}

/** Server quantities are whole units. */
export const wholeQuantity = (q: number) => Math.max(1, Math.round(Number.isFinite(q) ? q : 1));

/** Builds the payload from the device cart. Items saved before seller ids were stored are looked up once. */
export async function buildMergePayload(items: CartItem[]): Promise<MergeGuestCartRequest> {
  const out: GuestCartItemDto[] = [];
  for (const i of items) {
    let sellerId = i.sellerId;
    if (!sellerId) {
      try {
        sellerId = (await listingsService.publicDetail(i.listingId)).seller.sellerId;
      } catch {
        continue; // listing gone: nothing to merge
      }
    }
    out.push({ listingId: i.listingId, sellerId, quantity: wholeQuantity(i.quantity), addedPrice: i.unitPrice, addedCurrency: i.currency });
  }
  return { items: out };
}

/**
 * Sends the merge. Reuses the pending key and payload if one exists (a retry); otherwise freezes a new one.
 * Throws on any failure and leaves the pending record (and the device cart) in place.
 */
export async function runGuestMerge(items: CartItem[]): Promise<BuyerCartResponse> {
  let pending = readPendingMerge();
  if (!pending) {
    pending = { key: newIdempotencyKey(), payload: await buildMergePayload(items), createdAtUtc: new Date().toISOString() };
    writePendingMerge(pending);
  }
  const cart = await buyerCommerceService.merge(pending.payload, pending.key);
  writePendingMerge(null);
  return cart;
}
