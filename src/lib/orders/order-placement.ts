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
 * One selection per seller in the authorisation snapshot (the server checks every seller has exactly one). Collect
 * from seller only: delivery modes, fees and VAT issuer are not approved yet (COM-DEL-01).
 */
export function collectionSelections(s: Pick<PaymentAuthorizationStatusResponse, "reservations">): SellerSubOrderDeliverySelection[] {
  const bySeller = new Map<string, string | null>();
  for (const r of s.reservations) if (!bySeller.has(r.sellerId)) bySeller.set(r.sellerId, r.sellerOrganizationId ?? null);
  return [...bySeller].map(([sellerId, sellerOrganizationId]) => ({ sellerId, sellerOrganizationId, deliveryMode: "SELF_COLLECTION", shippingOptionCode: null, overrideDeliveryAddressId: null, buyerDeliveryInstructions: null }));
}

export function placementRequest(s: PaymentAuthorizationStatusResponse): PlaceBuyerOrderRequest {
  return {
    paymentAuthorizationAttemptId: s.attemptId,
    cartId: s.cartId,
    purchasingOrganizationId: s.buyerOrganizationId ?? null,
    deliveryAddressId: null,
    expectedPayableTotal: s.authorizedAmount,
    currency: "AED",
    sellerSelections: collectionSelections(s),
  };
}

/** Idempotency key per authorisation, kept for the tab so a retry (or a reload mid-request) is the same request. */
const keyOf = (attemptId: string) => `stockout.market.place-order.${attemptId}`;
export const placementKey = {
  get(attemptId: string): string {
    try {
      const existing = sessionStorage.getItem(keyOf(attemptId));
      if (existing) return existing;
      const fresh = `order-${newId()}`;
      sessionStorage.setItem(keyOf(attemptId), fresh);
      return fresh;
    } catch {
      return `order-${attemptId}`;
    }
  },
  clear(attemptId: string) {
    try {
      sessionStorage.removeItem(keyOf(attemptId));
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
  ORDER_PLACEMENT_DELIVERY_NOT_APPROVED: "Collection orders aren't open yet. Your payment stays a hold on your card; nothing is charged.",
  ORDER_PLACEMENT_DELIVERY_BREAKDOWN_UNAVAILABLE: "This payment includes delivery, which can't be ordered yet. Cancel the payment and choose collection.",
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
  COM_DEL_SELLER_SELECTION_MISMATCH: "Every seller in your order needs a collection or delivery choice. Reload and try again.",
  COM_DEL_MODE_UNSUPPORTED: "That delivery method isn't available. Choose collection.",
  COM_DEL_MODE_POLICY_GATED: "That delivery method isn't available yet. Choose collection.",
  INVALID_IF_MATCH_HEADER: "Your cart needs reloading before ordering. Reload and try again.",
  CART_CONCURRENCY_CONFLICT: "Your cart changed. Reload to review it before ordering.",
};
export const placementMessage = (e: unknown) => (isApiError(e) && e.code && PLACEMENT_MESSAGES[e.code]) || getErrorMessage(e);
/** Codes after which the cart / readiness must be re-read before anything else. */
export const PLACEMENT_CART_STALE = new Set(["ORDER_PLACEMENT_CART_NOT_FOUND_OR_STALE", "ORDER_PLACEMENT_SNAPSHOT_MISMATCH", "ORDER_PLACEMENT_AMOUNT_MISMATCH", "INVALID_IF_MATCH_HEADER", "CART_CONCURRENCY_CONFLICT"]);
