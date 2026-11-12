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
  /** Stage 8C.9: seller confirm / reject (POST /seller/orders/{id}/confirm|reject), live 12 Nov 2026. */
  sellerConfirmReject: true,
  /** Dispatch / delivered / claims: no approved contract. */
  sellerFulfilmentActions: false,
} as const;
