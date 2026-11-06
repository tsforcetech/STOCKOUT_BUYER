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

/** Handoff 8B.4 §2.4 badge / text / call to action per onboarding status. */
export const STATUS_UI: Record<string, { tone: "neutral" | "info" | "warning" | "danger" | "success"; label: string; cta: string }> = {
  NOT_STARTED: { tone: "neutral", label: "No payout account connected", cta: "Set up payout account" },
  IN_PROGRESS: { tone: "info", label: "Onboarding incomplete", cta: "Resume onboarding" },
  PENDING_VERIFICATION: { tone: "warning", label: "Verification pending", cta: "Check verification status" },
  RESTRICTED: { tone: "danger", label: "Payouts restricted", cta: "Update account details" },
  COMPLETED: { tone: "success", label: "Payout account active", cta: "Update account details" },
};
export const statusUi = (s: string | null | undefined) => STATUS_UI[s ?? ""] ?? { tone: "neutral" as const, label: s ?? "Unknown", cta: "Resume onboarding" };

const MESSAGES: Record<string, string> = {
  INVALID_REDIRECT_ORIGIN: "Payout setup can't start from this website yet: StockOut's payment service doesn't accept this site's address as a return page. Please contact StockOut support.",
  INVALID_REDIRECT_URL: "Payout setup can't start because the return address was refused. Please contact StockOut support.",
  MISSING_DEFAULT_REDIRECT_URL: "Payout setup isn't configured yet. Please contact StockOut support.",
  INVALID_SERVER_REDIRECT_CONFIG: "Payout setup isn't configured yet. Please contact StockOut support.",
  SELLER_NOT_ELIGIBLE_FOR_ONBOARDING: "Your seller account must be verified and active before you can set up payouts.",
  MARKETPLACE_SELLER_ACCESS_DENIED: "Only the owner or an admin of this seller account can manage its payout account.",
  SELLER_STRIPE_ACCOUNT_NOT_FOUND: "There's no payout account yet. Start the setup first.",
  MISSING_SELLER_ID: "Choose a seller account first.",
  INVALID_SELLER_ID: "Choose a seller account first.",
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
  const start = React.useCallback(async () => {
    if (!sellerId) return;
    setBusy(true);
    setError(null);
    try {
      const body = stripeRedirectUrls();
      const link = mode === "refresh" ? await sellerStripeService.refreshLink(sellerId, body) : await sellerStripeService.onboardingLink(sellerId, body);
      if (!link.url) throw new Error("No onboarding link was returned.");
      window.location.assign(link.url);
    } catch (e) {
      setError(stripeMessage(e));
      setBusy(false);
    }
  }, [sellerId, mode]);
  return { start, busy, error };
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
