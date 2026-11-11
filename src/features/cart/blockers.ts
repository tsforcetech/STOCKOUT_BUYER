import type { CheckoutBlockerDto } from "@/api/types/buyer-commerce";

/** Checkout-readiness blocker codes (stable) → shopper wording. The backend `message` is shown as detail. */
export const BLOCKER_TEXT: Record<string, string> = {
  BUYER_IDENTITY_VERIFICATION_REQUIRED: "Verify your account before buying. You can keep adding to your cart in the meantime.",
  MULTIPLE_ORGANIZATIONS: "You belong to more than one company. Choose which one is buying at checkout.",
  LISTING_UNAVAILABLE: "An item is no longer available. Remove it or save it for later.",
  INSUFFICIENT_STOCK: "An item has less stock than you asked for. Change the quantity.",
  COMMERCE_WHOLE_LOT_REQUIRED: "An item is sold as a whole lot only.",
  COMMERCE_MIN_ORDER_QTY_NOT_MET: "An item is below the seller's minimum order quantity.",
  MIXED_CURRENCY_NOT_SUPPORTED: "Your cart has items in different currencies, so it can't be totalled or checked out together.",
  TAX_RATE_UNAVAILABLE: "VAT can't be estimated right now. Your cart still works; checkout waits until it can.",
  BUYER_ORGANIZATION_REQUIRED: "You buy as a business. Choose the company you're buying for at checkout.",
  BUYER_ORGANIZATION_UNAUTHORIZED: "Your account isn't authorised to buy for this company. Ask your company's owner to check your role.",
  COMMERCE_SELF_PURCHASE_DENIED: "You can't buy your own business's listings. Remove them from your cart.",
  CART_EMPTY: "Your cart is empty.",
};

/** Quantity rules carry the exact constraint in the backend message, so that text is shown as-is. */
const USE_BACKEND_MESSAGE = new Set(["COMMERCE_WHOLE_LOT_REQUIRED", "COMMERCE_MIN_ORDER_QTY_NOT_MET"]);

/** Unknown codes get a safe generic message with the code as a support reference (never raw backend text). */
export const blockerText = (b: Pick<CheckoutBlockerDto, "code" | "message">) =>
  USE_BACKEND_MESSAGE.has(b.code) && b.message ? b.message : (BLOCKER_TEXT[b.code] ?? `Checkout can't continue right now. Contact StockOut support and quote ${b.code}.`);

/** Blockers the buyer clears on the checkout page itself (choosing who is buying), so the cart still lets them through. */
export const RESOLVED_AT_CHECKOUT = new Set(["BUYER_ORGANIZATION_REQUIRED", "MULTIPLE_ORGANIZATIONS"]);
