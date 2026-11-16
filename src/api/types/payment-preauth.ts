/**
 * Stage 8C.10 buyer payment pre-authorisation (bidding-deal, commit 2feeb05):
 *   Emcore.BiddingDeal.Contracts/Payments/PaymentPreAuthDtos.cs, BuyerPaymentAuthorizationsController.cs.
 * Gated OFF (ORDER_API.paymentPreAuth): Stripe and post-auth holds are not activated. Never treat a Stripe.js callback
 * as authorisation; only the status GET is authoritative. clientSecret must never be logged or stored.
 */
type Guid = string;
type Utc = string;

export interface CreatePaymentAuthorizationRequest {
  cartId: Guid;
  cartVersion: string;
  /** null for an individual (B2C) buyer; the cart's authorised company for B2B. */
  purchasingOrganizationId: Guid | null;
  checkoutCorrelationId?: string | null;
  /** A conflict check only; the server prices the order. */
  expectedTotalAmount?: number | null;
  currency: "AED";
}

export interface PaymentAuthorizationReservationDto {
  reservationId: Guid;
  listingId: Guid;
  sellerId: Guid;
  sellerOrganizationId: Guid | null;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  lineVat: number;
  lineTotal: number;
  currency: string;
  reservationStatus: string;
  expiresAtUtc: Utc;
  postAuthHeldAtUtc: Utc | null;
}

interface PaymentAuthorizationCommon {
  attemptId: Guid;
  checkoutCorrelationId: string;
  cartId: Guid;
  buyerUserId: Guid;
  buyerOrganizationId: Guid | null;
  buyerAccountType: string;
  paymentProvider: string;
  paymentIntentId: string | null;
  clientSecret: string | null;
  captureMethod: string;
  providerStatus: string;
  internalStatus: string;
  authorizedAmount: number;
  materialSubtotal: number;
  vatAmount: number;
  deliveryAmount: number;
  deliveryVatAmount: number;
  currency: string;
  reservationStatus: string;
  earliestReservationExpiresAtUtc: Utc | null;
  threeDsRequired: boolean;
  isProviderVerified: boolean;
  createdAtUtc: Utc;
  reservations: PaymentAuthorizationReservationDto[];
}

export interface PaymentAuthorizationInitiationResponse extends PaymentAuthorizationCommon {
  cartVersion: string;
  isIdempotentReplay: boolean;
}

export interface PaymentAuthorizationStatusResponse extends PaymentAuthorizationCommon {
  orderId: Guid | null;
  orderNumber: string | null;
  capturableAmount: number;
  threeDsCompletedAtUtc: Utc | null;
  paymentAuthorizedAtUtc: Utc | null;
  authorizationExpiresAtUtc: Utc | null;
  recoveryStatus: string;
  failureCode: string | null;
  failureMessage: string | null;
  updatedAtUtc: Utc | null;
  /** B05 hints */
  orderPlaced: boolean;
  recommendedPollIntervalSeconds: number;
  maxActivePollingDurationSeconds: number;
  pollingWindowExpiresAtUtc: Utc | null;
  shouldContinueActivePolling: boolean;
  isDelayedProcessing: boolean;
  canManualRefresh: boolean;
  browserCallbackIsAuthoritative: boolean;
}
