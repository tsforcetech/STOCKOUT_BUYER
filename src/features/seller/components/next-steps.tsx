import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CaretRightIcon, CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";
import { SectionCard } from "@/components/common/section-card";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { SellerContextResponse } from "@/api/types/user-organization";
import { correctionKeys } from "../lib/corrections";
import { canManageListings } from "./listing-access-notice";
import { useStripeStatus } from "../payouts/payout-shared";

interface Step {
  key: string;
  title: string;
  hint: string;
  done: boolean;
  to: string;
  cta: string;
}

/**
 * Home "next steps": what a seller should do next, built only from real data (seller status, payout account,
 * listing count, proposals waiting). Each open step links to the page that finishes it.
 */
export function NextSteps({ seller, listingCount, listingCountLoading }: { seller: SellerContextResponse; listingCount: number | undefined; listingCountLoading: boolean }) {
  const canList = canManageListings(seller);
  const stripe = useStripeStatus(seller.isOwner ? seller.sellerId : undefined);
  const corrections = useQuery({
    queryKey: correctionKeys.pending(seller.sellerId),
    queryFn: ({ signal }) => sellerListingsService.corrections(seller.sellerId, { status: "AWAITING_SELLER_DECISION", page: 1, pageSize: 100 }, signal),
    enabled: canList,
    staleTime: 30_000,
  });
  const waiting = corrections.data?.totalCount ?? corrections.data?.items?.length ?? 0;
  const verified = seller.verificationStatus === "VERIFIED" && seller.status === "ACTIVE";

  const steps: Step[] = [
    {
      key: "verify",
      title: "Get your business verified",
      hint: verified ? "Verified — you can publish listings." : "Upload your documents so StockOut can verify your business.",
      done: verified,
      to: seller.verificationStatus === "VERIFIED" ? "/seller/business" : "/seller/verify",
      cta: "Continue verification",
    },
    ...(seller.isOwner
      ? [
          {
            key: "payouts",
            title: "Connect your payout account",
            hint: stripe.data?.onboardingStatus === "COMPLETED" ? "Connected — ready for payouts at launch." : "Add the bank account your sales are paid into (via Stripe).",
            done: stripe.data?.onboardingStatus === "COMPLETED",
            to: "/seller/payout-settings",
            cta: stripe.data?.onboardingStatus === "NOT_STARTED" || !stripe.data ? "Set up payouts" : "Finish setup",
          },
        ]
      : []),
    {
      key: "listing",
      title: "Add your first listing",
      hint: listingCount ? `${listingCount} listing${listingCount === 1 ? "" : "s"} created.` : "Add one item, or upload many from Excel.",
      done: !!listingCount,
      to: "/seller/listings/quick",
      cta: "Add listing",
    },
    {
      key: "proposals",
      title: "Answer inspector proposals",
      hint: waiting ? `${waiting} proposal${waiting === 1 ? "" : "s"} waiting for your decision.` : "Nothing waiting. Proposals appear here after an inspection.",
      done: waiting === 0,
      to: "/seller/corrections",
      cta: "Review proposals",
    },
  ];
  const loading = listingCountLoading || (seller.isOwner && stripe.isLoading) || (canList && corrections.isLoading);
  const left = steps.filter((s) => !s.done).length;

  return (
    <SectionCard>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold text-foreground">{left === 0 && !loading ? "You're all set" : "Next steps"}</h2>
        {!loading && (
          <p className="text-sm text-muted-foreground">
            {steps.length - left} of {steps.length} done
          </p>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          {steps.map((s) => (
            <Skeleton key={s.key} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Next steps">
          {steps.map((s) => (
            <li key={s.key}>
              <Link
                to={s.to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors sm:px-4",
                  s.done ? "border-border bg-surface-muted/50" : "border-border-strong hover:bg-surface-muted",
                )}
              >
                {s.done ? <CheckCircleIcon className="size-6 shrink-0 text-success" weight="fill" aria-hidden /> : <CircleIcon className="size-6 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", s.done ? "text-muted-foreground line-through decoration-1" : "text-foreground")}>
                    {s.title}
                    <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
                {!s.done && (
                  <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-foreground sm:inline-flex">
                    {s.cta} <CaretRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                )}
                {!s.done && <CaretRightIcon className="size-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden />}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
