import { http } from "@/lib/api/client";
import type { CreateStripeOnboardingLinkRequest, SellerStripeStatusResponse, StripeAccountSyncResponse, StripeOnboardingLinkResponse } from "@/api/types/stripe";

const base = "/api/v1/seller/stripe";
const seg = encodeURIComponent;

/**
 * Stage 8B.4 seller payout account (Stripe Connect Express) — bidding-deal SellerStripeConnectController.
 * The seller organisation is passed in the route; the backend checks the signed-in user may manage it
 * (403 MARKETPLACE_SELLER_ACCESS_DENIED otherwise). Onboarding happens on Stripe's hosted pages; nothing here moves money.
 */
export const sellerStripeService = {
  status: (sellerId: string, signal?: AbortSignal) => http.get<SellerStripeStatusResponse>(`${base}/${seg(sellerId)}/status`, { signal }),
  /** Creates the connected account on first use; returns a one-time Stripe link. */
  onboardingLink: (sellerId: string, body: CreateStripeOnboardingLinkRequest) => http.post<StripeOnboardingLinkResponse>(`${base}/${seg(sellerId)}/onboarding-link`, body),
  /** New link when the previous one expired (Stripe sends the seller to the refresh URL). */
  refreshLink: (sellerId: string, body: CreateStripeOnboardingLinkRequest) => http.post<StripeOnboardingLinkResponse>(`${base}/${seg(sellerId)}/refresh-link`, body),
  /** Pulls the authoritative account state from Stripe (never trust the return redirect alone). */
  sync: (sellerId: string) => http.post<StripeAccountSyncResponse>(`${base}/${seg(sellerId)}/sync`),
};

/** Return / refresh pages on this site (paths on the backend's approved list). */
export function stripeRedirectUrls(): Required<CreateStripeOnboardingLinkRequest> {
  const root = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  return { returnUrl: new URL("seller/stripe/return", root).href, refreshUrl: new URL("seller/stripe/refresh", root).href };
}
