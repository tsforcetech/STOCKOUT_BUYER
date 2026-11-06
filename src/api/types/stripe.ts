/**
 * Stage 8B.4 seller Stripe Connect contracts, copied from bidding-deal Contracts/Stripe/SellerStripeDtos.cs.
 * Responses have NO envelope (bidding-deal returns the object itself); errors are ProblemDetails with `code`.
 */
type Guid = string;

/** NOT_STARTED | IN_PROGRESS | PENDING_VERIFICATION | RESTRICTED | COMPLETED (handoff 8B.4 §2.4). */
export type StripeOnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "RESTRICTED" | "COMPLETED" | (string & {});

/** C#: SellerStripeStatusResponse — GET /api/v1/seller/stripe/status?sellerId= */
export interface SellerStripeStatusResponse {
  sellerOrganizationId: Guid;
  stripeAccountId: string | null;
  isConnected: boolean;
  onboardingStatus: StripeOnboardingStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
  requirementsEventuallyDue: string[];
  requirementsPastDue: string[];
  disabledReason: string | null;
  lastSyncedAtUtc: string | null;
}

/** C#: CreateStripeOnboardingLinkRequest. URLs must be on the server's approved origin + path lists. */
export interface CreateStripeOnboardingLinkRequest {
  returnUrl?: string | null;
  refreshUrl?: string | null;
}

/** C#: StripeOnboardingLinkResponse — short-lived (~15 min) Stripe-hosted onboarding URL. */
export interface StripeOnboardingLinkResponse {
  url: string;
  expiresAtUtc: string;
}

/** C#: StripeAccountSyncResponse — POST /api/v1/seller/stripe/sync */
export interface StripeAccountSyncResponse {
  success: boolean;
  message: string;
  status: SellerStripeStatusResponse;
}
