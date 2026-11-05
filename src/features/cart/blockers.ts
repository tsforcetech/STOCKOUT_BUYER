import type { CheckoutBlockerDto } from "@/api/types/buyer-commerce";

/** Checkout-readiness blocker codes (stable) → shopper wording. The backend `message` is shown as detail. */
export const BLOCKER_TEXT: Record<string, string> = {
  BUYER_IDENTITY_VERIFICATION_REQUIRED: "Verify your account before buying. You can keep adding to your cart in the meantime.",
  MULTIPLE_ORGANIZATIONS: "Your account belongs to more than one organisation. Choosing which one buys isn't available yet, so checkout is blocked. Contact StockOut support.",
  LISTING_UNAVAILABLE: "An item is no longer available. Remove it or save it for later.",
  INSUFFICIENT_STOCK: "An item has less stock than you asked for. Change the quantity.",
  COMMERCE_WHOLE_LOT_REQUIRED: "An item is sold as a whole lot only.",
  COMMERCE_MIN_ORDER_QTY_NOT_MET: "An item is below the seller's minimum order quantity.",
  MIXED_CURRENCY_NOT_SUPPORTED: "Your cart has items in different currencies, so it can't be totalled or checked out together.",
  TAX_RATE_UNAVAILABLE: "VAT can't be estimated right now. Your cart still works; checkout waits until it can.",
  BUYER_ORGANIZATION_REQUIRED: "Your account isn't linked to an approved business yet. Set up or join your company before checking out.",
  CART_EMPTY: "Your cart is empty.",
};

export const blockerText = (b: CheckoutBlockerDto) => BLOCKER_TEXT[b.code] ?? b.message;
