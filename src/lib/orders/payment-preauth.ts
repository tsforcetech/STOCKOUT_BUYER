import { http } from "@/lib/api/client";
import type { CreatePaymentAuthorizationRequest, PaymentAuthorizationInitiationResponse, PaymentAuthorizationStatusResponse } from "@/api/types/payment-preauth";

const BASE = "/api/v1/buyer/checkout/payment-authorizations";

/**
 * Stage 8C.10 client, prepared but NOT used while ORDER_API.paymentPreAuth is false. Responses have no envelope
 * (bidding-deal). Retry an uncertain initiation with the SAME Idempotency-Key and body, never a new attempt.
 */
export const paymentPreAuthService = {
  initiate: (body: CreatePaymentAuthorizationRequest, cartRowVersion: string, idempotencyKey: string) =>
    http.post<PaymentAuthorizationInitiationResponse>(BASE, body, { headers: { "If-Match": `"${cartRowVersion}"`, "Idempotency-Key": idempotencyKey } }),
  status: (attemptId: string, signal?: AbortSignal) =>
    http.get<PaymentAuthorizationStatusResponse>(`${BASE}/${encodeURIComponent(attemptId)}`, { query: { includeClientSecret: false }, signal }),
  cancel: (attemptId: string, reason: string) => http.post<unknown>(`${BASE}/${encodeURIComponent(attemptId)}/cancel`, { reason }),
};

/** Only this combination may be shown as "payment authorised" (never "order placed": orders aren't created yet). */
export const isAuthorizedAndHeld = (s: Pick<PaymentAuthorizationStatusResponse, "internalStatus" | "isProviderVerified" | "reservationStatus" | "reservations">) =>
  s.internalStatus === "AUTHORIZED" && s.isProviderVerified && s.reservationStatus === "HELD_POST_AUTH" && s.reservations.every((r) => r.reservationStatus === "HELD_POST_AUTH");

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
