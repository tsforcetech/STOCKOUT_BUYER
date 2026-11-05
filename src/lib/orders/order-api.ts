/**
 * Stage 8B order API availability. Every flag is false because the backend has no controller for these routes
 * (live gateway: 404 unmatched_gateway_route, 5 Nov 2026). The screens are built against the C# DTOs in
 * src/api/types/orders.ts and show an "isn't available yet" state until a flag flips with a real endpoint.
 * Do NOT add fetch calls for these routes before the backend publishes them.
 */
export const ORDER_API = {
  /** GET /api/v1/orders (proposed) */
  buyerOrders: false,
  /** GET /api/v1/orders/{orderId} (proposed) */
  buyerOrderDetail: false,
  /** GET /api/v1/seller/orders (proposed) */
  sellerOrders: false,
  /** GET /api/v1/seller/orders/{subOrderId} (proposed) */
  sellerOrderDetail: false,
  /** GET /api/v1/orders/{orderId}/history (proposed) */
  orderHistory: false,
  /** POST /api/v1/orders/checkout: policy blocked (CR-01, Stripe rules) */
  placeOrder: false,
  /** POST /api/v1/seller/orders/{id}/confirm: policy blocked (seller confirmation SLA) */
  sellerConfirm: false,
} as const;
