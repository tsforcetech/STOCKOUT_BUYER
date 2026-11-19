import { env } from "@/config/env";

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
  /**
   * Stage 8C.10 payment pre-authorisation (Stripe sandbox, manual capture). Off unless VITE_PAYMENT_PREAUTH=on and a
   * pk_test_ key are set (handoff 18 Nov 2026: only for approved Tier B sandbox testing). Never an order or a charge.
   */
  paymentPreAuth: env.paymentPreAuthEnabled,
  /** Order placement POST: not implemented / approved. */
  placeOrder: false,
  /** Stage 8C.9: seller confirm / reject (POST /seller/orders/{id}/confirm|reject), live 12 Nov 2026. */
  sellerConfirmReject: true,
  /**
   * BD-ORDER-LIFECYCLE-01 seller fulfilment (prepare, ready for pickup, confirm collection, claims and evidence views).
   * Off: migration 015 is not on the operational database (POST-DEPLOY-UAT-02, 19 Nov 2026) and no orders exist.
   */
  sellerFulfilmentActions: env.orderLifecycleEnabled,
  /** Buyer acceptance and claims on delivered sub-orders (same backend dependency; VITE_ORDER_LIFECYCLE). */
  buyerAcceptance: env.orderLifecycleEnabled,
  /**
   * SUS-03 buyer/seller sustainability impact reports. Off: Wave A public activation is policy-blocked, migration 014 is
   * missing and the list/download gateway routes are not published. VITE_SUSTAINABILITY_REPORTS=on switches it on.
   */
  sustainabilityReports: env.sustainabilityReportsEnabled,
} as const;
