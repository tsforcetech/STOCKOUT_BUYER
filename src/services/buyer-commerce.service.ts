import { http } from "@/lib/api/client";
import type {
  AddCartItemRequest,
  AddWishlistItemRequest,
  BuyerCartResponse,
  BuyerWishlistResponse,
  MergeGuestCartRequest,
  MoveToCartResponse,
  SavedItemsResponse,
  WishlistCheckResponse,
} from "@/api/types/buyer-commerce";

const cart = "/api/v1/buyer/cart";
const saved = `${cart}/saved-items`;
const wishlist = "/api/v1/buyer/wishlist";
const seg = encodeURIComponent;

/** Optional optimistic-concurrency header: the cart's base64 rowVersion, quoted. */
const ifMatch = (rowVersion?: string | null): Record<string, string> | undefined => (rowVersion ? { "If-Match": `"${rowVersion}"` } : undefined);

/** Stage 8A.2 buyer cart, save-for-later and wishlist (bidding-deal via the API gateway). All authenticated. */
export const buyerCommerceService = {
  cart: (signal?: AbortSignal) => http.get<BuyerCartResponse>(cart, { signal }),
  addItem: (body: AddCartItemRequest, rowVersion?: string | null) => http.post<BuyerCartResponse>(`${cart}/items`, body, { headers: ifMatch(rowVersion) }),
  updateQuantity: (listingId: string, quantity: number, rowVersion?: string | null) =>
    http.put<BuyerCartResponse>(`${cart}/items/${seg(listingId)}`, { quantity }, { headers: ifMatch(rowVersion) }),
  removeItem: (listingId: string, rowVersion?: string | null) => http.delete<BuyerCartResponse>(`${cart}/items/${seg(listingId)}`, { headers: ifMatch(rowVersion) }),
  clear: (rowVersion?: string | null) => http.delete<BuyerCartResponse>(cart, { headers: ifMatch(rowVersion) }),
  /** Idempotency-Key (8–100 chars, [A-Za-z0-9._-]) is required; retries must reuse the key and the identical payload. */
  merge: (body: MergeGuestCartRequest, idempotencyKey: string) => http.post<BuyerCartResponse>(`${cart}/merge`, body, { headers: { "Idempotency-Key": idempotencyKey } }),

  savedItems: (signal?: AbortSignal) => http.get<SavedItemsResponse>(saved, { signal }),
  saveForLater: (listingId: string, rowVersion?: string | null) => http.post<BuyerCartResponse>(`${saved}/${seg(listingId)}`, undefined, { headers: ifMatch(rowVersion) }),
  savedToCart: (listingId: string, rowVersion?: string | null) => http.post<BuyerCartResponse>(`${saved}/${seg(listingId)}/move-to-cart`, undefined, { headers: ifMatch(rowVersion) }),
  removeSaved: (listingId: string, rowVersion?: string | null) => http.delete<BuyerCartResponse>(`${saved}/${seg(listingId)}`, { headers: ifMatch(rowVersion) }),

  wishlist: (page: number, pageSize: number, signal?: AbortSignal) => http.get<BuyerWishlistResponse>(wishlist, { query: { page, pageSize }, signal }),
  addToWishlist: (body: AddWishlistItemRequest) => http.post<boolean>(`${wishlist}/items`, body),
  removeFromWishlist: (listingId: string) => http.delete<boolean>(`${wishlist}/items/${seg(listingId)}`),
  wishlistCheck: (listingId: string, signal?: AbortSignal) => http.get<WishlistCheckResponse>(`${wishlist}/items/${seg(listingId)}/check`, { signal }),
  /** The DTO also needs listingId: send the same value in the route and the body. */
  wishlistToCart: (listingId: string, quantity = 1) =>
    http.post<MoveToCartResponse>(`${wishlist}/items/${seg(listingId)}/move-to-cart`, { listingId, quantity }),
};
