import { useQuery } from "@tanstack/react-query";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";
import { marketplaceService } from "@/services/marketplace.service";
import { cn } from "@/lib/utils/cn";

export const buyerEligibilityKey = ["buyer", "eligibility"] as const;

/** BK-1 eligibility for the signed-in user. Only fetched when signed in; never assumed true on error. */
export function useBuyerEligibility() {
  const { status } = useAuth();
  return useQuery({
    queryKey: buyerEligibilityKey,
    queryFn: ({ signal }) => marketplaceService.buyerEligibility(signal),
    enabled: status === "authenticated",
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

const DENIED: Record<string, string> = {
  SUSPENDED: "Your account is suspended, so buying is turned off. Contact StockOut support.",
  LOCKED: "Your account is locked, so buying is turned off. Reset your password or contact support.",
  DISABLED: "Your account is disabled, so buying is turned off. Contact StockOut support.",
  PENDING_VERIFICATION: "Verify your email address to buy on StockOut.",
  NOT_FOUND: "We couldn't find your account details. Sign out and in again, or contact support.",
  UNAVAILABLE: "We couldn't confirm your buying access right now. Please try again later.",
};

/**
 * Shows whether this account may buy (BK-1: no buyer KYC needed). Kept separate from checkout itself,
 * which stays "coming soon" until the order and payment services exist.
 */
export function BuyerEligibilityNote({ className }: { className?: string }) {
  const { status } = useAuth();
  const q = useBuyerEligibility();
  if (status !== "authenticated" || q.isLoading) return null;
  const e = q.data;
  const ok = !!e && e.canPurchase && e.eligible;
  const text = ok
    ? "Your account can buy on StockOut — no company verification needed."
    : q.error
      ? DENIED.UNAVAILABLE
      : (DENIED[(e?.verificationStatus ?? "").toUpperCase()] ?? e?.reason ?? DENIED.UNAVAILABLE);
  const Icon = ok ? CheckCircleIcon : WarningCircleIcon;
  return (
    <p role="status" className={cn("flex items-start gap-2 rounded-lg p-3 text-xs leading-5", ok ? "bg-success-soft text-success-soft-foreground" : "bg-warning-soft text-warning-soft-foreground", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" weight={ok ? "fill" : "regular"} aria-hidden />
      <span>{text}</span>
    </p>
  );
}
