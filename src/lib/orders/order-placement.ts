import { http } from "@/lib/api/client";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { newId } from "@/lib/utils/id";
import type { PaymentAuthorizationStatusResponse } from "@/api/types/payment-preauth";
import type { PlaceBuyerOrderRequest, PlaceBuyerOrderResponse, SellerSubOrderDeliverySelection } from "@/api/types/order-placement";
import { UNCERTAIN_CODES } from "./placement-outcome";

/**
 * COM-ORD-01 order placement client (handoff 20 Nov 2026 §4.3, §6 step 5, §7). Called only while ORDER_API.placeOrder
 * is on and only for an authorisation the server has verified with the provider. A retry after a lost answer reuses
 * the SAME Idempotency-Key and body; an uncertain commit is never retried automatically.
 */
export const orderPlacementService = {
  place: (body: PlaceBuyerOrderRequest, cartRowVersion: string, idempotencyKey: string) =>
    http.post<PlaceBuyerOrderResponse>("/api/v1/buyer/checkout/orders", body, { headers: { "If-Match": `"${cartRowVersion}"`, "Idempotency-Key": idempotencyKey } }),
};

/** C# CheckoutOrderStage: the only stages in which an order exists. */
export const ORDER_PLACED_STAGES = new Set(["ORDER_CREATED", "SELLER_CONFIRMATION_PENDING"]);
/** Stages in which the authorisation is ready to become an order. */
export const PLACEABLE_STAGES = new Set(["INVENTORY_PROTECTED", "ORDER_PLACEMENT_PENDING"]);

type Status = Pick<PaymentAuthorizationStatusResponse, "internalStatus" | "isProviderVerified" | "checkoutStage" | "orderPlaced" | "orderId">;

/** The server already holds an order for this authorisation (e.g. placed in another tab, or after a reload). */
export const hasPlacedOrder = (s: Status) => (s.orderPlaced || ORDER_PLACED_STAGES.has(s.checkoutStage)) && !!s.orderId;

/** Place order is offered only for AUTHORIZED + provider-verified + stock protected, and no order yet. */
export const canPlaceOrder = (s: Status) => s.internalStatus === "AUTHORIZED" && s.isProviderVerified && PLACEABLE_STAGES.has(s.checkoutStage) && !hasPlacedOrder(s);

/**
 * Owner decision 22 Nov 2026: buyers get freight delivery only (no collect-from-seller). StockOut arranges the freight
 * (PLATFORM_ARRANGED_DELIVERY); whether StockOut or the seller ends up moving the goods is handled after the order,
 * not chosen by the buyer. One selection per seller in the authorisation snapshot (the server checks every seller has
 * exactly one). The server takes the delivery address from deliveryAddressId (UserOrganization snapshot).
 * Until the backend approves delivery modes (COM-DEL-01 gate) it refuses these orders with
 * ORDER_PLACEMENT_DELIVERY_NOT_APPROVED; that is shown as "not open yet", never worked around with collection.
 */
export const BUYER_DELIVERY_MODE = "PLATFORM_ARRANGED_DELIVERY" as const;

export function freightSelections(s: Pick<PaymentAuthorizationStatusResponse, "reservations">): SellerSubOrderDeliverySelection[] {
  const bySeller = new Map<string, string | null>();
  for (const r of s.reservations) if (!bySeller.has(r.sellerId)) bySeller.set(r.sellerId, r.sellerOrganizationId ?? null);
  return [...bySeller].map(([sellerId, sellerOrganizationId]) => ({ sellerId, sellerOrganizationId, deliveryMode: BUYER_DELIVERY_MODE, shippingOptionCode: null, overrideDeliveryAddressId: null, buyerDeliveryInstructions: null }));
}

export function placementRequest(s: PaymentAuthorizationStatusResponse, deliveryAddressId: string): PlaceBuyerOrderRequest {
  return {
    paymentAuthorizationAttemptId: s.attemptId,
    cartId: s.cartId,
    purchasingOrganizationId: s.buyerOrganizationId ?? null,
    deliveryAddressId,
    expectedPayableTotal: s.authorizedAmount,
    currency: "AED",
    sellerSelections: freightSelections(s),
  };
}

/**
 * Idempotency key per authorisation and delivery address, kept for the tab so a retry (or a reload mid-request) is the
 * same request. Choosing another address makes a different request, so it gets its own key (the server still allows
 * only one order per authorisation).
 */
const keyOf = (attemptId: string, addressId = "") => `stockout.market.place-order.${attemptId}${addressId ? `.${addressId}` : ""}`;
export const placementKey = {
  get(attemptId: string, addressId?: string): string {
    try {
      const existing = sessionStorage.getItem(keyOf(attemptId, addressId));
      if (existing) return existing;
      const fresh = `order-${newId()}`;
      sessionStorage.setItem(keyOf(attemptId, addressId), fresh);
      return fresh;
    } catch {
      return `order-${attemptId}`;
    }
  },
  clear(attemptId: string, addressId?: string) {
    try {
      sessionStorage.removeItem(keyOf(attemptId, addressId));
    } catch {
      /* ignore */
    }
  },
};

/** "Don't retry, we're checking": the order may or may not exist. */
export const isUncertainPlacement = (e: unknown) => !isApiError(e) || e.kind === "network" || e.kind === "timeout" || (!!e.code && UNCERTAIN_CODES.has(e.code));

/** OrderPlacementApiErrorCodes / OrderPlacementErrorCodes / COM-DEL-01 codes → buyer wording. */
export const PLACEMENT_MESSAGES: Record<string, string> = {
  ORDER_PLACEMENT_DISABLED: "Ordering isn't open yet. Your payment stays a hold on your card; nothing is charged.",
  ORDER_PLACEMENT_PREREQUISITES_NOT_MET: "Ordering isn't open yet. Your payment stays a hold on your card; nothing is charged.",
  ORDER_PLACEMENT_DELIVERY_NOT_APPROVED: "Freight delivery orders aren't open yet. Your payment stays a hold on your card and nothing is charged; it's released automatically if no order is placed.",
  ORDER_PLACEMENT_DELIVERY_BREAKDOWN_UNAVAILABLE: "We can't confirm the delivery charge for this order yet. Your payment stays a hold on your card; nothing is charged.",
  ORDER_PLACEMENT_PAYMENT_NOT_AUTHORIZED: "Your payment isn't authorised yet. Wait for the confirmation above, then try again.",
  ORDER_PLACEMENT_AUTHORIZATION_EXPIRED: "Your payment hold expired. Check your cart again and authorise a new payment.",
  ORDER_PLACEMENT_RESERVATION_NOT_HELD: "Your items are no longer reserved. Check your cart again and authorise a new payment.",
  ORDER_PLACEMENT_AMOUNT_MISMATCH: "Your total changed. Check your cart again before ordering.",
  ORDER_PLACEMENT_CART_NOT_FOUND_OR_STALE: "Your cart changed. Reload to review it before ordering.",
  ORDER_PLACEMENT_SNAPSHOT_MISMATCH: "Your cart changed since you authorised the payment. Reload to review it before ordering.",
  ORDER_PLACEMENT_ATTEMPT_ALREADY_BOUND: "This payment is already linked to an order. Check My orders.",
  ORDER_PLACEMENT_ATTEMPT_NOT_FOUND: "We couldn't find this payment. Start the payment again.",
  ORDER_PLACEMENT_IDEMPOTENCY_CONFLICT: "This order request changed while it was being sent. Check My orders before trying again.",
  ORDER_PLACEMENT_RECOVERY_IN_PROGRESS: "We're still confirming an earlier order request. Check My orders in a few minutes.",
  ORDER_PLACEMENT_ADDRESS_SNAPSHOT_INVALID: "Your delivery address needs updating. Check it in your address book.",
  ORDER_PLACEMENT_ADDRESS_SNAPSHOT_UNAVAILABLE: "We couldn't check your address right now. Try again in a moment.",
  BUYER_ADDRESS_LOCATION_REQUIRED: "Add a map pin to your delivery address, then try again.",
  ORDER_PLACEMENT_CATALOG_SNAPSHOT_UNAVAILABLE: "We couldn't confirm the items right now. Try again in a moment.",
  ORDER_PLACEMENT_NUMBER_ALLOCATION_UNAVAILABLE: "Ordering is temporarily unavailable. Try again in a moment.",
  ORDER_PLACEMENT_PERSISTENCE_UNAVAILABLE: "Ordering is temporarily unavailable. Try again in a moment.",
  COM_DEL_SELLER_SELECTION_MISMATCH: "Your order's sellers changed. Reload and try again.",
  COM_DEL_MODE_UNSUPPORTED: "Freight delivery isn't available for this order yet. Your payment stays a hold; nothing is charged.",
  COM_DEL_MODE_POLICY_GATED: "Freight delivery orders aren't open yet. Your payment stays a hold; nothing is charged.",
  INVALID_IF_MATCH_HEADER: "Your cart needs reloading before ordering. Reload and try again.",
  CART_CONCURRENCY_CONFLICT: "Your cart changed. Reload to review it before ordering.",
};
export const placementMessage = (e: unknown) => (isApiError(e) && e.code && PLACEMENT_MESSAGES[e.code]) || getErrorMessage(e);
/** Codes meaning ordering or freight is switched off on the server: the same request can't succeed until it opens. */
export const PLACEMENT_CLOSED = new Set(["ORDER_PLACEMENT_DISABLED", "ORDER_PLACEMENT_PREREQUISITES_NOT_MET", "ORDER_PLACEMENT_DELIVERY_NOT_APPROVED", "ORDER_PLACEMENT_DELIVERY_BREAKDOWN_UNAVAILABLE", "COM_DEL_MODE_POLICY_GATED", "COM_DEL_MODE_UNSUPPORTED"]);

/** Codes after which the cart / readiness must be re-read before anything else. */
export const PLACEMENT_CART_STALE = new Set(["ORDER_PLACEMENT_CART_NOT_FOUND_OR_STALE", "ORDER_PLACEMENT_SNAPSHOT_MISMATCH", "ORDER_PLACEMENT_AMOUNT_MISMATCH", "INVALID_IF_MATCH_HEADER", "CART_CONCURRENCY_CONFLICT"]);
