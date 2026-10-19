import { Link } from "react-router";
import { HourglassIcon, SealCheckIcon, ShieldWarningIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/feedback/states";
import { formatDateTime } from "@/lib/utils/format";
import type { MarketplaceSellerDto } from "@/api/types/user-organization";
import { cn } from "@/lib/utils/cn";

interface Props {
  seller: MarketplaceSellerDto | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Hide the "go to business page" button when already there. */
  showLink?: boolean;
}

function describe(s: MarketplaceSellerDto) {
  if (s.status === "SUSPENDED")
    return {
      icon: <WarningOctagonIcon />,
      tone: "danger" as const,
      title: "Seller account suspended",
      body: "The marketplace team suspended this account. Listings can't be managed until it is reinstated. Contact support for details.",
      cta: null,
    };
  switch (s.verificationStatus) {
    case "VERIFIED":
      return { icon: <SealCheckIcon />, tone: "success" as const, title: "You're verified", body: `Verified ${formatDateTime(s.verifiedAtUtc)}. Your live listings are visible to buyers in search.`, cta: null };
    case "PENDING":
      return {
        icon: <HourglassIcon />,
        tone: "warning" as const,
        title: "Verification under review",
        body: `Submitted ${formatDateTime(s.submittedAtUtc)}. We'll update your status once the review is complete. You can keep preparing listings meanwhile.`,
        cta: null,
      };
    case "REJECTED":
      return {
        icon: <ShieldWarningIcon />,
        tone: "danger" as const,
        title: "Verification was not approved",
        body: "Review your documents, upload corrected or missing ones, then submit for review again.",
        cta: "Fix & resubmit",
      };
    default:
      return {
        icon: <ShieldWarningIcon />,
        tone: "neutral" as const,
        title: "Verify your seller account",
        body: "Upload your verification documents and submit them for review. Listings only appear in buyer search once you're verified.",
        cta: "Upload documents & submit",
      };
  }
}

export function VerificationCard({ seller, isLoading, error, onRetry, showLink = true }: Props) {
  if (error) return <SectionCard><ErrorState error={error} onRetry={onRetry} title="Couldn't load verification status" /></SectionCard>;
  if (isLoading || !seller)
    return (
      <SectionCard>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      </SectionCard>
    );
  const d = describe(seller);
  return (
    <SectionCard className="flex flex-wrap items-start gap-x-4 gap-y-3 sm:flex-nowrap sm:items-center">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-12 [&_svg]:size-6",
          d.tone === "success" && "bg-success-soft text-success-soft-foreground",
          d.tone === "warning" && "bg-warning-soft text-warning-soft-foreground",
          d.tone === "danger" && "bg-danger-soft text-danger-soft-foreground",
          d.tone === "neutral" && "bg-action-soft text-foreground ring-1 ring-action-border/30",
        )}
        aria-hidden
      >
        {d.icon}
      </span>
      <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="font-heading text-lg font-bold text-foreground">{d.title}</h2>
          <StatusBadge value={seller.verificationStatus} />
          {seller.verificationStatus !== "VERIFIED" && (
            <StatusBadge value={seller.onboardingStatus} label={`Onboarding: ${seller.onboardingStatus.toLowerCase().replace(/_/g, " ")}`} />
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{d.body}</p>
      </div>
      {showLink && d.cta && (
        <Button asChild variant="action" className="w-full sm:w-auto">
          <Link to="/seller/business">{d.cta}</Link>
        </Button>
      )}
    </SectionCard>
  );
}
