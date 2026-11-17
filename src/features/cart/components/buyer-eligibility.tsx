import { useQuery } from "@tanstack/react-query";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";
import { marketplaceService } from "@/services/marketplace.service";
import { cn } from "@/lib/utils/cn";

export const buyerEligibilityKey = ["buyer", "eligibility"] as const;

/** BK-1 eligibility for the signed-in user. Only fetched when signed in; never assumed true on error. */
export function useBuyerEligibility(organizationId?: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...buyerEligibilityKey, organizationId?.toLowerCase() ?? "any"],
    queryFn: ({ signal }) => marketplaceService.buyerEligibility(signal, organizationId),
    enabled: status === "authenticated",
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export const DENIED: Record<string, string> = {
  SUSPENDED: "Your account is suspended, so buying is turned off. Contact StockOut support.",
  LOCKED: "Your account is locked, so buying is turned off. Reset your password or contact support.",
  DISABLED: "Your account is disabled, so buying is turned off. Contact StockOut support.",
  PENDING_VERIFICATION: "Verify your email address to buy on StockOut.",
  NOT_FOUND: "We couldn't find your account details. Sign out and in again, or contact support.",
  UNAVAILABLE: "We couldn't confirm your buying access right now. Please try again later.",
  // BE-12: the public check now also answers for the company (same rules as checkout).
  BUYER_ORGANIZATION_REQUIRED: "You buy as a business. Choose the company you're buying for at checkout.",
  MULTIPLE_ORGANIZATIONS: "You belong to more than one company. Choose which one is buying at checkout.",
  BUYER_ORGANIZATION_UNAUTHORIZED: "Your account isn't authorised to buy for this company. Choose another company or ask its owner to check your role.",
  DRAFT: "Verify your identity to buy on StockOut. You can keep adding to your cart in the meantime.",
  NOT_REGISTERED: "Verify your identity to buy on StockOut. You can keep adding to your cart in the meantime.",
  SUBMITTED: "Your verification is being reviewed. You can buy once it's approved.",
  REJECTED: "Your verification wasn't approved. Open Verification to see why and resubmit.",
  REVERIFICATION_REQUIRED: "Please verify your identity again to keep buying.",
};

/** Eligibility statuses that mean "choose / fix the purchasing company", not "verify your identity". */
export const ORGANIZATION_STATUSES = new Set(["BUYER_ORGANIZATION_REQUIRED", "MULTIPLE_ORGANIZATIONS", "BUYER_ORGANIZATION_UNAUTHORIZED"]);

/**
 * Shows whether this account may buy (BK-1 account check). Cart checkout readiness can still require identity
 * verification (BUYER_IDENTITY_VERIFICATION_REQUIRED), so this never claims that no verification is needed.
 */
export function BuyerEligibilityNote({ className }: { className?: string }) {
  const { status } = useAuth();
  const q = useBuyerEligibility();
  if (status !== "authenticated" || q.isLoading) return null;
  const e = q.data;
  const ok = !!e && e.canPurchase && e.eligible;
  const text = ok
    ? "Your account is active and allowed to buy on StockOut."
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
