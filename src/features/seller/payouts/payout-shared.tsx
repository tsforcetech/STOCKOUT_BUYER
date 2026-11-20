import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { sellerStripeService, stripeRedirectUrls } from "@/services/seller-stripe.service";
import type { SellerStripeStatusResponse } from "@/api/types/stripe";

export const stripeKeys = { status: (sellerId: string) => ["seller", "stripe", sellerId] as const };

export function useStripeStatus(sellerId: string | undefined) {
  return useQuery({
    queryKey: stripeKeys.status(sellerId ?? ""),
    queryFn: ({ signal }) => sellerStripeService.status(sellerId!, signal),
    enabled: !!sellerId,
    staleTime: 0,
  });
}

/** Badge / text / call to action per onboarding status (handoff 8B.4 §2.4; CTAs per consolidated handoff 18 Nov §4.3). */
export const STATUS_UI: Record<string, { tone: "neutral" | "info" | "warning" | "danger" | "success"; label: string; cta: string }> = {
  NOT_STARTED: { tone: "neutral", label: "No payout account connected", cta: "Set up payouts" },
  IN_PROGRESS: { tone: "info", label: "Onboarding incomplete", cta: "Continue setup" },
  PENDING_VERIFICATION: { tone: "warning", label: "Verification pending", cta: "Review requirements" },
  RESTRICTED: { tone: "danger", label: "Payouts restricted", cta: "Resolve restrictions" },
  COMPLETED: { tone: "success", label: "Ready to receive payouts", cta: "Update account details" },
};
export const statusUi = (s: string | null | undefined) => STATUS_UI[s ?? ""] ?? { tone: "neutral" as const, label: s ?? "Unknown", cta: "Continue setup" };

/**
 * Stripe handoff 03 (20 Nov 2026, decisions A1/B1/F1): sellers are transfer recipients, so readiness is
 * onboardingStatus COMPLETED + recipientTransferReady. chargesEnabled stays false and is never a warning.
 */
export const isPayoutReady = (s: Pick<SellerStripeStatusResponse, "onboardingStatus" | "recipientTransferReady"> | null | undefined) =>
  !!s && s.onboardingStatus === "COMPLETED" && s.recipientTransferReady === true;

/** COMPLETED but not yet able to receive transfers is not shown as ready: Stripe still has something to switch on. */
export const payoutUi = (s: SellerStripeStatusResponse) =>
  s.onboardingStatus === "COMPLETED" && !isPayoutReady(s) ? { tone: "warning" as const, label: "Transfers not enabled yet", cta: "Review requirements" } : statusUi(s.onboardingStatus);

/** Errors that mean this user can't manage the seller's payouts (not a glitch to retry). */
export const STRIPE_DENIED = new Set(["MARKETPLACE_SELLER_ACCESS_DENIED", "UNAUTHORIZED_SELLER_ACCESS"]);

const MESSAGES: Record<string, string> = {
  INVALID_REDIRECT_ORIGIN: "Payout setup can't start from this website yet: StockOut's payment service doesn't accept this site's address as a return page. Please contact StockOut support.",
  INVALID_REDIRECT_URL: "Payout setup can't start because the return address was refused. Please contact StockOut support.",
  INVALID_REDIRECT_PATH: "Payout setup can't start because the return address was refused. Please contact StockOut support.",
  MISSING_DEFAULT_REDIRECT_URL: "Payout setup isn't configured yet. Please contact StockOut support.",
  INVALID_SERVER_REDIRECT_CONFIG: "Payout setup isn't configured yet. Please contact StockOut support.",
  SELLER_NOT_ELIGIBLE_FOR_ONBOARDING: "Your seller account must be verified and active before you can set up payouts.",
  SELLER_NOT_VERIFIED: "Your seller account must be verified and active before you can set up payouts.",
  MARKETPLACE_SELLER_ACCESS_DENIED: "Only the owner or an admin of this seller account can manage its payout account.",
  UNAUTHORIZED_SELLER_ACCESS: "Only the owner or an admin of this seller account can manage its payout account.",
  SELLER_STRIPE_ACCOUNT_NOT_FOUND: "There's no payout account yet. Start the setup first.",
  MISSING_SELLER_ID: "Choose a seller account first.",
  INVALID_SELLER_ID: "Choose a seller account first.",
  STRIPE_API_ERROR: "Stripe couldn't be reached just now. Nothing was changed; try again in a moment.",
  STRIPE_INTEGRATION_DISABLED: "Payout setup isn't open yet. Please try again later.",
  // Handoff 03 gate: StockOut's own Stripe profile is awaiting sign-off.
  STRIPE_PROVIDER_CONFIGURATION_UNAPPROVED: "Payout setup isn't open yet: StockOut is finishing its payment set-up with Stripe. Please try again later.",
  SANDBOX_PRODUCTION_ENVIRONMENT_PROHIBITED: "Payout setup isn't open yet: StockOut is finishing its payment set-up with Stripe. Please try again later.",
  CONCURRENT_ONBOARDING_IN_PROGRESS: "Payout setup is already starting in another window. Wait a moment, then try again.",
  SELLER_STRIPE_ACCOUNT_CLOSED: "Your Stripe payout account was closed. Contact StockOut support at info@stockoutme.com to restore payouts.",
  // Accounts v2 (handoff 19 Nov §3): Stripe needs the organisation's business contact email; StockOut never invents one.
  SELLER_CONTACT_EMAIL_MISSING: "Add a business contact email to your business profile first. Stripe needs it to create your payout account.",
};
export const stripeMessage = (e: unknown) => (isApiError(e) && e.code && MESSAGES[e.code]) || getErrorMessage(e);

/** Turns Stripe requirement keys (e.g. individual.verification.document) into readable text. */
export function requirementLabel(key: string): string {
  const known: Record<string, string> = {
    external_account: "Bank account (IBAN) for payouts",
    "business_profile.url": "Business website",
    "business_profile.mcc": "Business category",
    "tos_acceptance.date": "Accept Stripe's terms",
    "tos_acceptance.ip": "Accept Stripe's terms",
    "individual.verification.document": "Identity document",
    "individual.verification.additional_document": "Additional identity document",
    "company.verification.document": "Company document",
    "representative.verification.document": "Representative's identity document",
  };
  if (known[key]) return known[key];
  const words = key.replace(/^(individual|company|representative|business_profile|person_[^.]+)\./, "").replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Starts (or resumes) Stripe-hosted onboarding: gets a one-time link and leaves the site. */
export function useStartOnboarding(sellerId: string | undefined, mode: "start" | "refresh" = "start") {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const start = React.useCallback(async () => {
    if (!sellerId) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    try {
      const body = stripeRedirectUrls();
      let link;
      try {
        link = mode === "refresh" ? await sellerStripeService.refreshLink(sellerId, body) : await sellerStripeService.onboardingLink(sellerId, body);
      } catch (e) {
        // No account to refresh (handoff §4.4): start onboarding instead.
        if (mode !== "refresh" || !isApiError(e) || e.code !== "SELLER_STRIPE_ACCOUNT_NOT_FOUND") throw e;
        link = await sellerStripeService.onboardingLink(sellerId, body);
      }
      if (!link.url) throw new Error("No onboarding link was returned.");
      window.location.assign(link.url);
    } catch (e) {
      setError(stripeMessage(e));
      setErrorCode(isApiError(e) ? (e.code ?? null) : null);
      setBusy(false);
    }
  }, [sellerId, mode]);
  return { start, busy, error, errorCode };
}

/** Sync from Stripe and store the authoritative status. */
export function useStripeSync(sellerId: string | undefined) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const sync = React.useCallback(async (): Promise<SellerStripeStatusResponse | null> => {
    if (!sellerId) return null;
    setBusy(true);
    setError(null);
    try {
      const res = await sellerStripeService.sync(sellerId);
      qc.setQueryData(stripeKeys.status(sellerId), res.status);
      setMessage(res.message || null);
      return res.status;
    } catch (e) {
      setError(stripeMessage(e));
      void qc.invalidateQueries({ queryKey: stripeKeys.status(sellerId) });
      return null;
    } finally {
      setBusy(false);
    }
  }, [sellerId, qc]);
  return { sync, busy, error, message };
}
