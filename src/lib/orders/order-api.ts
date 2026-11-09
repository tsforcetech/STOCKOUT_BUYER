/**
 * Order API availability. Stage 8C published the read-only routes (live-checked 9 Nov 2026); every mutation is still
 * unavailable. Do NOT add calls for a `false` flag before the backend publishes an approved contract.
 */
export const ORDER_API = {
  /** GET /api/v1/buyer/checkout/readiness */
  checkoutReadiness: true,
  /** GET /api/v1/buyer/orders and /buyer/orders/{orderId} */
  buyerOrders: true,
  /** GET /api/v1/seller/orders and /seller/orders/{subOrderId} */
  sellerOrders: true,
  /** Order placement POST: not implemented / approved. */
  placeOrder: false,
  /** Seller confirm / reject / dispatch / delivered: no approved contract. */
  sellerActions: false,
} as const;
