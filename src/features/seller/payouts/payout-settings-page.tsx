import { Link } from "react-router";
import { ArrowSquareOutIcon, ArrowsClockwiseIcon, BankIcon, CheckCircleIcon, InfoIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Notice } from "@/features/seller/components/notice";
import { useSellerMode } from "@/lib/seller/seller-context";
import { formatDateTime } from "@/lib/utils/format";
import { isApiError } from "@/lib/api/errors";
import type { SellerStripeStatusResponse } from "@/api/types/stripe";
import { requirementLabel, statusUi, stripeMessage, useStartOnboarding, useStripeStatus, useStripeSync } from "./payout-shared";

/**
 * Seller payout account (Stage 8B.4, Stripe Connect Express). Status always comes from the backend; returning from Stripe
 * proves nothing, so the return page syncs first. StockOut does not send payouts yet — this only connects the account.
 */
export default function PayoutSettingsPage() {
  const { activeSeller } = useSellerMode();
  const sellerId = activeSeller?.sellerId;
  const q = useStripeStatus(sellerId);
  const onboarding = useStartOnboarding(sellerId);
  const sync = useStripeSync(sellerId);
  const s = q.data;
  const ui = statusUi(s?.onboardingStatus);
  const denied = isApiError(q.error) && q.error.code === "MARKETPLACE_SELLER_ACCESS_DENIED";

  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Payout account"
        description="Connect the bank account StockOut will pay your sales into. Setup happens securely on Stripe, our payments partner."
      />
      <div className="space-y-4">
        {q.isLoading ? (
          <SectionCard>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-6 h-10 w-48" />
          </SectionCard>
        ) : denied ? (
          <Notice tone="warning" title="You can't manage payouts for this account">
            {stripeMessage(q.error)}
          </Notice>
        ) : q.error || !s ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <>
            <SectionCard>
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-cream">
                  <BankIcon className="size-6 text-foreground" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-bold text-foreground">Stripe payout account</h2>
                    <Badge tone={ui.tone} dot>
                      {ui.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-body">{summary(s)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.lastSyncedAtUtc ? `Last checked with Stripe ${formatDateTime(s.lastSyncedAtUtc)}` : "Not checked with Stripe yet"}
                    {s.stripeAccountId ? ` · Account ${s.stripeAccountId}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {s.onboardingStatus === "PENDING_VERIFICATION" ? (
                  <Button onClick={() => void sync.sync()} loading={sync.busy}>
                    <ArrowsClockwiseIcon /> {ui.cta}
                  </Button>
                ) : (
                  <Button onClick={() => void onboarding.start()} loading={onboarding.busy}>
                    <ArrowSquareOutIcon /> {ui.cta}
                  </Button>
                )}
                {s.isConnected && s.onboardingStatus !== "PENDING_VERIFICATION" && (
                  <Button variant="secondary" onClick={() => void sync.sync()} loading={sync.busy}>
                    <ArrowsClockwiseIcon /> Refresh status
                  </Button>
                )}
              </div>
              {(onboarding.error || sync.error) && (
                <Notice tone="danger" className="mt-4">
                  {onboarding.error ?? sync.error}
                </Notice>
              )}
              {sync.message && !sync.error && <p className="mt-3 text-xs text-muted-foreground">{sync.message}</p>}
            </SectionCard>

            {s.isConnected && (
              <SectionCard>
                <h2 className="font-heading text-base font-bold text-foreground">Capabilities</h2>
                <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <Capability ok={s.detailsSubmitted} label="Details submitted" />
                  <Capability ok={s.chargesEnabled} label="Can receive payments" />
                  <Capability ok={s.payoutsEnabled} label="Payouts to bank enabled" />
                </ul>
                {s.disabledReason && <p className="mt-3 text-sm text-danger-soft-foreground">Stripe reason: {s.disabledReason.replace(/[._]/g, " ")}</p>}
              </SectionCard>
            )}

            <Requirements s={s} onResume={() => void onboarding.start()} busy={onboarding.busy} />

            <p className="flex items-start gap-2 rounded-xl bg-surface p-4 text-xs leading-5 text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Connecting your account doesn't move any money. Online ordering and payouts open at launch; until then StockOut doesn't charge buyers or pay out. Your bank details stay with Stripe. Need
                help? <Link to="/legal" className="underline underline-offset-4">Policies</Link> · info@stockoutme.com
              </span>
            </p>
          </>
        )}
      </div>
    </>
  );
}

function summary(s: SellerStripeStatusResponse): string {
  switch (s.onboardingStatus) {
    case "NOT_STARTED":
      return "Set up a payout account so you can receive money from your sales once ordering opens.";
    case "IN_PROGRESS":
      return "You started setting up your payout account but haven't finished. Continue where you left off on Stripe.";
    case "PENDING_VERIFICATION":
      return "Stripe is reviewing the details you submitted. This usually takes a few minutes, sometimes a few days.";
    case "RESTRICTED":
      return "Stripe has restricted payouts on this account. Update the details Stripe asks for below, or contact StockOut support.";
    case "COMPLETED":
      return "Your payout account is connected and verified.";
    default:
      return "Check your payout account status with Stripe.";
  }
}

function Capability({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircleIcon className="size-4 text-success" weight="fill" aria-hidden /> : <XCircleIcon className="size-4 text-muted-foreground" aria-hidden />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {label}
        <span className="sr-only">{ok ? ": yes" : ": not yet"}</span>
      </span>
    </li>
  );
}

function Requirements({ s, onResume, busy }: { s: SellerStripeStatusResponse; onResume: () => void; busy: boolean }) {
  const groups = [
    { title: "Overdue", items: s.requirementsPastDue, tone: "danger" as const },
    { title: "Needed now", items: s.requirementsCurrentlyDue, tone: "warning" as const },
    { title: "Needed later", items: s.requirementsEventuallyDue.filter((r) => !s.requirementsCurrentlyDue.includes(r) && !s.requirementsPastDue.includes(r)), tone: "info" as const },
  ].filter((g) => g.items.length > 0);
  if (!groups.length) return null;
  const urgent = s.requirementsPastDue.length + s.requirementsCurrentlyDue.length > 0;
  return (
    <SectionCard>
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
        <WarningCircleIcon className="size-5" aria-hidden /> Stripe needs more information
      </h2>
      {urgent && <p className="mt-1 text-sm text-body">Stripe requires additional information to enable bank payouts. Select Resume onboarding to provide it.</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
            <ul className="mt-1.5 space-y-1 text-sm text-foreground">
              {g.items.map((r) => (
                <li key={r}>{requirementLabel(r)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {urgent && (
        <Button className="mt-4" variant="secondary" onClick={onResume} loading={busy}>
          <ArrowSquareOutIcon /> Resume onboarding
        </Button>
      )}
    </SectionCard>
  );
}
