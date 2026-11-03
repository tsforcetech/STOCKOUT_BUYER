import { getErrorMessage, isApiError } from "@/lib/api/errors";

/** Stage 8A.2 error codes (ProblemDetails `code`) → shopper wording. Backend `detail` is used when we have nothing better. */
const MESSAGES: Record<string, string> = {
  INVALID_QUANTITY: "Enter a whole quantity of 1 or more.",
  COMMERCE_LISTING_NOT_AVAILABLE: "This listing isn't available to buy right now.",
  LISTING_UNAVAILABLE: "This listing isn't available to buy right now.",
  LISTING_NOT_FOUND: "This listing no longer exists.",
  COMMERCE_WHOLE_LOT_REQUIRED: "This seller only sells the whole lot. Set the quantity to the full lot size.",
  COMMERCE_MIN_ORDER_QTY_NOT_MET: "This is below the seller's minimum order quantity.",
  COMMERCE_SELF_PURCHASE_DENIED: "You can't buy stock from your own seller account.",
  CART_ITEM_LIMIT_EXCEEDED: "Your cart already has 50 different items, the maximum. Remove or save one for later first.",
  CART_CONCURRENCY_CONFLICT: "Your cart changed in another tab or device. We've reloaded it; check it and try again.",
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH: "We couldn't add your saved items safely. Please try again.",
  CONCURRENT_REQUEST_IN_FLIGHT: "We're still adding your saved items. Try again in a moment.",
  IDEMPOTENCY_TOKEN_UNAVAILABLE: "The cart service is busy. Your items are kept; try again shortly.",
};

export const commerceCode = (e: unknown): string | undefined => (isApiError(e) ? e.code : undefined);

/** Backend validation detail is clearer than a generic line for min-order / whole-lot (it carries the numbers). */
const PREFER_DETAIL = new Set(["COMMERCE_WHOLE_LOT_REQUIRED", "COMMERCE_MIN_ORDER_QTY_NOT_MET"]);

export function commerceErrorMessage(e: unknown): string {
  const code = commerceCode(e);
  if (code && PREFER_DETAIL.has(code) && isApiError(e) && e.message) return e.message;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return getErrorMessage(e);
}
