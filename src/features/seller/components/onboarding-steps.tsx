import { CheckIcon } from "@phosphor-icons/react";
import type { SellerOnboardingStatus, SellerVerificationStatus } from "@/api/types/user-organization";
import { cn } from "@/lib/utils/cn";

const STEPS = [
  { title: "Create seller account", body: "Tell us whether you sell as a business or an individual." },
  { title: "Upload verification documents", body: "Trade licence, Emirates ID, VAT certificate or similar." },
  { title: "Submit for review", body: "Our team checks your documents, usually within a few working days." },
  { title: "Verified", body: "Your live listings become visible to buyers in search." },
] as const;

/** 0-based index of the step the seller is on (4 = all done). */
export function onboardingStepIndex(seller: { onboardingStatus: SellerOnboardingStatus; verificationStatus: SellerVerificationStatus } | null, documentCount?: number): number {
  if (!seller) return 0;
  if (seller.verificationStatus === "VERIFIED") return 4;
  if (seller.onboardingStatus === "SUBMITTED" || seller.onboardingStatus === "UNDER_REVIEW" || seller.verificationStatus === "PENDING") return 3;
  return documentCount && documentCount > 0 ? 2 : 1;
}

export function OnboardingSteps({ current, className, orientation = "vertical" }: { current: number; className?: string; orientation?: "vertical" | "horizontal" }) {
  return (
    <ol className={cn(orientation === "horizontal" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "space-y-4", className)} aria-label="Seller onboarding steps">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.title} className="flex gap-3" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                done ? "border-action-border bg-action text-action-foreground" : active ? "border-foreground bg-foreground text-surface" : "border-secondary-border bg-surface text-muted-foreground",
              )}
              aria-hidden
            >
              {done ? <CheckIcon weight="bold" className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cn("font-heading text-base font-bold", done || active ? "text-foreground" : "text-muted-foreground")}>
                {step.title}
                <span className="sr-only">{done ? " (done)" : active ? " (current step)" : ""}</span>
              </p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
