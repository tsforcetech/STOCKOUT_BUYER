import { formatDateTime, isUnsetDate } from "@/lib/utils/format";
import type { MarketplaceSellerDto } from "@/api/types/user-organization";
import { cn } from "@/lib/utils/cn";

/** Status history derived from the seller's timestamps (the API exposes no event log). */
export function SellerTimeline({ seller }: { seller: MarketplaceSellerDto }) {
  const events = [
    { label: "Seller account created", at: seller.createdAtUtc, tone: "neutral" },
    { label: "Submitted for review", at: seller.submittedAtUtc, tone: "warning" },
    { label: "Verification rejected", at: seller.rejectedAtUtc, tone: "danger" },
    { label: "Verified", at: seller.verifiedAtUtc, tone: "success" },
    { label: "Account suspended", at: seller.suspendedAtUtc, tone: "danger" },
  ]
    .filter((e): e is { label: string; at: string; tone: string } => !isUnsetDate(e.at))
    .sort((a, b) => (a.at < b.at ? -1 : 1));

  return (
    <ol className="relative space-y-4 border-l border-border pl-5" aria-label="Verification timeline">
      {events.map((e) => (
        <li key={e.label} className="relative">
          <span
            className={cn(
              "absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-surface",
              e.tone === "success" ? "bg-success" : e.tone === "danger" ? "bg-danger" : e.tone === "warning" ? "bg-warning" : "bg-secondary-border",
            )}
            aria-hidden
          />
          <p className="text-sm font-medium text-foreground">{e.label}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
        </li>
      ))}
      <li className="text-xs text-muted-foreground">Only the latest submission, rejection and verification times are recorded.</li>
    </ol>
  );
}
