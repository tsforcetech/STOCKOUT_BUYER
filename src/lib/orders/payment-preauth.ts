import { http } from "@/lib/api/client";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import type { CreatePaymentAuthorizationRequest, PaymentAuthorizationInitiationResponse, PaymentAuthorizationStatusResponse } from "@/api/types/payment-preauth";

const BASE = "/api/v1/buyer/checkout/payment-authorizations";

/**
 * Stage 8C.10 client, used only while ORDER_API.paymentPreAuth is on (Stripe sandbox). Responses have no envelope
 * (bidding-deal). Retry an uncertain initiation with the SAME Idempotency-Key and body, never a new attempt.
 * The only status route is GET /payment-authorizations/{attemptId} (never the obsolete /buyer/orders/pre-auth/status).
 */
export const paymentPreAuthService = {
  initiate: (body: CreatePaymentAuthorizationRequest, cartRowVersion: string, idempotencyKey: string) =>
    http.post<PaymentAuthorizationInitiationResponse>(BASE, body, { headers: { "If-Match": `"${cartRowVersion}"`, "Idempotency-Key": idempotencyKey } }),
  /** includeClientSecret only to resume card entry / 3DS; the server returns it just for REQUIRES_PAYMENT_METHOD / REQUIRES_ACTION. */
  status: (attemptId: string, signal?: AbortSignal, includeClientSecret = false) =>
    http.get<PaymentAuthorizationStatusResponse>(`${BASE}/${encodeURIComponent(attemptId)}`, { query: { includeClientSecret }, signal }),
  cancel: (attemptId: string, reason: string) => http.post<unknown>(`${BASE}/${encodeURIComponent(attemptId)}/cancel`, { reason }),
};

/** Only this combination may be shown as "payment authorised" (never "order placed": orders aren't created yet). */
export const isAuthorizedAndHeld = (s: Pick<PaymentAuthorizationStatusResponse, "internalStatus" | "isProviderVerified" | "reservationStatus" | "reservations">) =>
  s.internalStatus === "AUTHORIZED" && s.isProviderVerified && s.reservationStatus === "HELD_POST_AUTH" && s.reservations.every((r) => r.reservationStatus === "HELD_POST_AUTH");

/**
 * Consolidated handoff 18 Nov §7.3: "Payment authorised" needs AUTHORIZED AND isProviderVerified. It is a manual-capture
 * hold: never "paid", "captured" or "order placed".
 */
export const isProviderAuthorized = (s: Pick<PaymentAuthorizationStatusResponse, "internalStatus" | "isProviderVerified">) => s.internalStatus === "AUTHORIZED" && s.isProviderVerified;

/** B05 polling: every recommended interval (5 s), stop at the server's window or 120 s, then offer a manual refresh. */
export function shouldKeepPolling(s: Pick<PaymentAuthorizationStatusResponse, "shouldContinueActivePolling" | "pollingWindowExpiresAtUtc" | "maxActivePollingDurationSeconds">, startedAt: number, now = Date.now()) {
  if (!s.shouldContinueActivePolling) return false;
  const windowEnd = s.pollingWindowExpiresAtUtc ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s.pollingWindowExpiresAtUtc) ? s.pollingWindowExpiresAtUtc : `${s.pollingWindowExpiresAtUtc}Z`) : startedAt + (s.maxActivePollingDurationSeconds || 120) * 1000;
  return now < Math.min(windowEnd, startedAt + 120_000);
}

/** Buyer wording per server state (handoff §7). Unknown states fall back to a neutral "checking" message. */
export const PREAUTH_LABEL: Record<string, string> = {
  INITIATED: "Preparing secure payment…",
  REQUIRES_PAYMENT_METHOD: "Complete your payment details",
  REQUIRES_ACTION: "Complete your bank verification",
  PROCESSING: "Verifying payment authorisation…",
  AUTHORIZED: "Payment authorised. Your order isn't placed yet.",
  AUTHORIZATION_FAILED: "Payment authorisation unsuccessful",
  AUTHORIZATION_EXPIRED: "Stock reservation expired. Refresh your checkout.",
  CANCELLATION_PENDING: "Cancelling authorisation…",
  CANCELLED: "Authorisation cancelled",
  RECONCILIATION_REQUIRED: "Payment is being reviewed",
};

/** Initiation / status / cancel error codes (handoff §7.7, bidding-deal PaymentPreAuthService) → buyer wording. */
export const PREAUTH_MESSAGES: Record<string, string> = {
  COMMERCE_IF_MATCH_REQUIRED: "Your cart needs reloading before payment. Reload and try again.",
  COMMERCE_INVALID_IF_MATCH: "Your cart needs reloading before payment. Reload and try again.",
  CART_CONCURRENCY_CONFLICT: "Your cart changed. Reload to review the latest prices and stock, then try again.",
  PAYMENT_PREAUTH_IDEMPOTENCY_KEY_REQUIRED: "Something went wrong starting the payment. Try again.",
  PAYMENT_PREAUTH_IDEMPOTENCY_CONFLICT: "That payment request changed while it was being sent. Try again.",
  PAYMENT_PREAUTH_CURRENCY_UNSUPPORTED: "Payments are only taken in AED.",
  PAYMENT_PREAUTH_AMOUNT_MISMATCH: "Your total changed. Check the updated total, then try again.",
  PAYMENT_PREAUTH_ACTIVE_ATTEMPT_CONFLICT: "A payment for this cart is already in progress. Finish it or wait a few minutes, then try again.",
  PAYMENT_PREAUTH_CHECKOUT_NOT_READY: "Your cart isn't ready for payment. Fix the items marked above first.",
  PAYMENT_PREAUTH_CHECKOUT_VALIDATION_FAILED: "Your cart isn't ready for payment. Fix the items marked above first.",
  PAYMENT_PREAUTH_EMPTY_CHECKOUT: "Your cart is empty.",
  PAYMENT_PREAUTH_CART_MISMATCH: "Your cart changed. Reload to review the latest prices and stock, then try again.",
  PAYMENT_PREAUTH_ALREADY_AUTHORIZED_PROTECTED: "This payment is already authorised and held for your order, so it can't be cancelled here. Contact StockOut support if you need to cancel.",
  PAYMENT_PREAUTH_NOT_FOUND: "We couldn't find this payment. Start the payment again.",
  PAYMENT_PREAUTH_FORBIDDEN: "We couldn't find this payment. Start the payment again.",
  PAYMENT_PREAUTH_INVALID_ATTEMPT_ID: "We couldn't find this payment. Start the payment again.",
  PAYMENT_PREAUTH_PROVIDER_INIT_FAILED: "Our payment provider couldn't start the payment. Nothing was charged; try again in a moment.",
  STRIPE_API_UNAVAILABLE: "Our payment provider is temporarily unavailable. Nothing was charged; try again in a moment.",
  STRIPE_API_ERROR: "Our payment provider is temporarily unavailable. Nothing was charged; try again in a moment.",
  STRIPE_INTEGRATION_DISABLED: "Card payment isn't open yet.",
  SANDBOX_PRODUCTION_ENVIRONMENT_PROHIBITED: "Card payment isn't open yet. Nothing was charged; your cart is saved.",
  INSUFFICIENT_STOCK: "An item no longer has enough stock. Change the quantity in your cart.",
  COMMERCE_BUYER_ORG_UNAUTHORIZED: "Your account isn't authorised to buy for this company. Choose another company or ask its owner to check your role.",
  COMMERCE_BUYER_ORG_MISMATCH: "The buying company changed. Choose the company you're buying for again.",
  COMMERCE_SELF_PURCHASE_DENIED: "You can't buy your own business's listings. Remove them from your cart.",
  COMMERCE_BUYER_INELIGIBLE: "Your account can't buy right now. Check your verification on the Buyer section above.",
};
export const preauthMessage = (e: unknown) => (isApiError(e) && e.code && PREAUTH_MESSAGES[e.code]) || getErrorMessage(e);

/** Codes that mean "the cart this page shows is stale": reload the cart and readiness. */
export const PREAUTH_CART_STALE = new Set(["COMMERCE_IF_MATCH_REQUIRED", "COMMERCE_INVALID_IF_MATCH", "CART_CONCURRENCY_CONFLICT", "PAYMENT_PREAUTH_CART_MISMATCH"]);

/**
 * The attempt this tab is working on, kept per cart so a retry after a timeout or a 3DS redirect resumes it instead of
 * starting a second PaymentIntent. Ids and the idempotency key only: the clientSecret is never stored.
 */
export interface StoredPreAuth {
  cartId: string;
  cartVersion: string;
  idempotencyKey: string;
  checkoutCorrelationId: string;
  /** Exactly what was sent, so a replay uses the same body as the same key. */
  expectedTotalAmount: number | null;
  attemptId: string | null;
}
const storeKey = (cartId: string) => `stockout.market.preauth.${cartId}`;
export const preAuthStore = {
  get(cartId: string): StoredPreAuth | null {
    try {
      const raw = sessionStorage.getItem(storeKey(cartId));
      return raw ? (JSON.parse(raw) as StoredPreAuth) : null;
    } catch {
      return null;
    }
  },
  set(value: StoredPreAuth) {
    try {
      sessionStorage.setItem(storeKey(value.cartId), JSON.stringify(value));
    } catch {
      /* storage unavailable: the attempt still works in this page */
    }
  },
  clear(cartId: string) {
    try {
      sessionStorage.removeItem(storeKey(cartId));
    } catch {
      /* ignore */
    }
  },
};
