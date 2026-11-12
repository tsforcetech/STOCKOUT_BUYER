import { http } from "@/lib/api/client";
import type { CheckoutValidationResult, MarketplaceOrderDto, SellerSubOrderDto } from "@/api/types/orders";

const seg = encodeURIComponent;

/** Page size for the order lists. The API returns a plain array (no totals); "Load more" stops when a page is short. */
export const ORDER_PAGE_SIZE = 20;

/**
 * Stage 8C read-only order APIs (bidding-deal via the API gateway). Nothing here creates or changes an order.
 * Seller routes take the seller as ?sellerId=: the gateway strips client X-Organization-Id headers
 * (HeaderManagementMiddleware), so the header never reaches the API. The backend checks membership and authority.
 * Never send `status`: server-side filtering is unsupported (400 STATUS_FILTERING_UNSUPPORTED).
 */
export const ordersService = {
  /** If-Match: the cart rowVersion being reviewed (409 CART_CONCURRENCY_CONFLICT when the cart changed). */
  checkoutReadiness: (cartRowVersion?: string | null, signal?: AbortSignal) =>
    http.get<CheckoutValidationResult>("/api/v1/buyer/checkout/readiness", { signal, headers: cartRowVersion ? { "If-Match": `"${cartRowVersion}"` } : undefined }),
  buyerOrders: (page: number, signal?: AbortSignal) => http.get<MarketplaceOrderDto[]>("/api/v1/buyer/orders", { query: { page, pageSize: ORDER_PAGE_SIZE }, signal }),
  buyerOrder: (orderId: string, signal?: AbortSignal) => http.get<MarketplaceOrderDto>(`/api/v1/buyer/orders/${seg(orderId)}`, { signal }),
  sellerOrders: (sellerId: string, page: number, signal?: AbortSignal) =>
    http.get<SellerSubOrderDto[]>("/api/v1/seller/orders", { query: { sellerId, page, pageSize: ORDER_PAGE_SIZE }, signal }),
  sellerOrder: (sellerId: string, subOrderId: string, signal?: AbortSignal) =>
    http.get<SellerSubOrderDto>(`/api/v1/seller/orders/${seg(subOrderId)}`, { query: { sellerId }, signal }),
};

/** Stage 8C.9 seller decisions (POST, rowVersion in the body). Both return the updated SellerSubOrderDto. */
export const sellerOrderActions = {
  confirm: (sellerId: string, subOrderId: string, expectedRowVersion: string) =>
    http.post<SellerSubOrderDto>(`/api/v1/seller/orders/${seg(subOrderId)}/confirm`, { expectedRowVersion }, { query: { sellerId } }),
  reject: (sellerId: string, subOrderId: string, reason: string, expectedRowVersion: string) =>
    http.post<SellerSubOrderDto>(`/api/v1/seller/orders/${seg(subOrderId)}/reject`, { reason, expectedRowVersion }, { query: { sellerId } }),
};

export const orderKeys = {
  readiness: (rv: string | null | undefined) => ["checkout", "readiness", rv ?? ""] as const,
  buyerList: ["orders", "buyer"] as const,
  buyerDetail: (id: string) => ["orders", "buyer", id] as const,
  sellerList: (sellerId: string) => ["orders", "seller", sellerId] as const,
  sellerDetail: (sellerId: string, id: string) => ["orders", "seller", sellerId, id] as const,
};
