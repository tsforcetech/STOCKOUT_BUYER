import { SealCheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

/**
 * Product-level "Verified": every listing buyers can see was reviewed and approved by the StockOut team before it
 * went live (publishing requires an admin approval). Not the seller's KYC, which is the green tick by the seller name.
 * When the API exposes inspection results, an "Inspected" variant goes next to this.
 */
export function VerifiedTag({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      title="Reviewed and approved by the StockOut team before going live"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-action font-heading font-bold text-action-foreground",
        size === "md" ? "px-2 py-0.5 text-xs" : "px-1.5 py-px text-[11px]",
        className,
      )}
    >
      <SealCheckIcon className={size === "md" ? "size-3.5" : "size-3"} weight="fill" aria-hidden /> Verified
    </span>
  );
}

/** The seller's KYC check: a small green tick after the seller name. */
export function SellerTick({ className }: { className?: string }) {
  return <SealCheckIcon className={cn("size-3.5 shrink-0 text-success", className)} weight="fill" role="img" aria-label="Verified seller" />;
}
