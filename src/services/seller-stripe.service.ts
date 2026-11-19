import { http } from "@/lib/api/client";
import type { CreateStripeOnboardingLinkRequest, SellerStripeStatusResponse, StripeAccountSyncResponse, StripeOnboardingLinkResponse } from "@/api/types/stripe";

const base = "/api/v1/seller/stripe";

/**
 * Stage 8B.4 seller payout account (Stripe Connect Express) — bidding-deal SellerStripeConnectController.
 * Consolidated handoff 18 Nov 2026 §4.1: the seller ORGANISATION id goes in the `sellerId` query on every call (the
 * gateway strips X-Organization-Id); the backend checks the signed-in user may manage it (403 otherwise).
 * Onboarding happens on Stripe's hosted pages; nothing here moves money.
 */
export const sellerStripeService = {
  status: (sellerId: string, signal?: AbortSignal) => http.get<SellerStripeStatusResponse>(`${base}/status`, { query: { sellerId }, signal }),
  /** Creates the connected account on first use; returns a one-time Stripe link. */
  onboardingLink: (sellerId: string, body: CreateStripeOnboardingLinkRequest) => http.post<StripeOnboardingLinkResponse>(`${base}/onboarding-link`, body, { query: { sellerId } }),
  /** New link when the previous one expired (Stripe sends the seller to the refresh URL). */
  refreshLink: (sellerId: string, body: CreateStripeOnboardingLinkRequest) => http.post<StripeOnboardingLinkResponse>(`${base}/refresh-link`, body, { query: { sellerId } }),
  /** Pulls the authoritative account state from Stripe (never trust the return redirect alone). */
  sync: (sellerId: string) => http.post<StripeAccountSyncResponse>(`${base}/sync`, undefined, { query: { sellerId } }),
};

/** Return / refresh pages on this site (paths on the backend's approved list). */
export function stripeRedirectUrls(): Required<CreateStripeOnboardingLinkRequest> {
  const root = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  return { returnUrl: new URL("seller/stripe/return", root).href, refreshUrl: new URL("seller/stripe/refresh", root).href };
}
