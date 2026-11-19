import * as React from "react";
import { Link } from "react-router";
import { ArrowsClockwiseIcon, BankIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { SectionCard } from "@/components/common/section-card";
import { Notice } from "@/features/seller/components/notice";
import { useSellerMode } from "@/lib/seller/seller-context";
import type { SellerStripeStatusResponse } from "@/api/types/stripe";
import { isPayoutReady, payoutUi, useStartOnboarding, useStripeSync } from "./payout-shared";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-6">
      <SectionCard>
        <span className="flex size-12 items-center justify-center rounded-xl bg-cream">
          <BankIcon className="size-6 text-foreground" aria-hidden />
        </span>
        {children}
      </SectionCard>
    </div>
  );
}

/**
 * /seller/stripe/return — Stripe sends the seller here when they finish OR leave onboarding, so this proves nothing:
 * sync with Stripe first and show what the backend reports.
 */
export function StripeReturnPage() {
  const { activeSeller } = useSellerMode();
  const sellerId = activeSeller?.sellerId;
  const { sync, busy, error } = useStripeSync(sellerId);
  const [status, setStatus] = React.useState<SellerStripeStatusResponse | null>(null);
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (!sellerId || ran.current) return;
    ran.current = true;
    void sync().then(setStatus);
  }, [sellerId, sync]);
  const ui = status ? payoutUi(status) : null;
  const check = () => void sync().then(setStatus);
  return (
    <Shell>
      <h1 className="mt-4 font-heading text-xl font-bold text-foreground">Back from Stripe</h1>
      {busy || (!status && !error) ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-body" role="status">
          <ArrowsClockwiseIcon className="size-4 animate-spin" aria-hidden /> Checking your payout account with Stripe…
        </p>
      ) : error ? (
        <Notice
          tone="danger"
          title="Unable to verify Stripe status"
          className="mt-3"
          action={
            <Button size="sm" variant="secondary" onClick={check} loading={busy}>
              <ArrowsClockwiseIcon /> Try again
            </Button>
          }
        >
          {error}
        </Notice>
      ) : status && ui ? (
        <div className="mt-2 space-y-2 text-sm text-body" role="status">
          <Badge tone={ui.tone} dot>
            {ui.label}
          </Badge>
          <p>
            {isPayoutReady(status)
              ? "Your payout account is connected and verified."
              : status.onboardingStatus === "COMPLETED"
                ? "Stripe hasn't switched on payments and payouts for this account yet. Check your payout page for what's still needed."
              : status.onboardingStatus === "PENDING_VERIFICATION"
                ? "Thanks. Stripe is reviewing your details; we'll show the result on your payout page."
                : "Your setup isn't finished yet. You can continue any time from your payout page."}
          </p>
        </div>
      ) : null}
      <Button asChild className="mt-5">
        <Link to="/seller/payout-settings">Go to payout account</Link>
      </Button>
    </Shell>
  );
}

/** /seller/stripe/refresh — the previous Stripe link expired; get a fresh one and continue. */
export function StripeRefreshPage() {
  const { activeSeller } = useSellerMode();
  const { start, busy, error } = useStartOnboarding(activeSeller?.sellerId, "refresh");
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (!activeSeller?.sellerId || ran.current) return;
    ran.current = true;
    void start();
  }, [activeSeller?.sellerId, start]);
  return (
    <Shell>
      <h1 className="mt-4 font-heading text-xl font-bold text-foreground">Continue payout setup</h1>
      {error ? (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm text-body" role="status">
          <ArrowsClockwiseIcon className="size-4 animate-spin" aria-hidden /> Your previous link expired. Opening a new one on Stripe…
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {error && (
          <Button onClick={() => void start()} loading={busy}>
            Try again
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link to="/seller/payout-settings">Back to payout account</Link>
        </Button>
      </div>
    </Shell>
  );
}

export default StripeReturnPage;
