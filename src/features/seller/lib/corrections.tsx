import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { NotePencilIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { CorrectionFieldComparisonDto, CorrectionStatus } from "@/api/types/listing-corrections";
import { Notice } from "../components/notice";
import { sellerKeys, useListingRequirements } from "./queries";

export const correctionKeys = {
  all: (sellerId: string) => [...sellerKeys.listings(sellerId), "corrections"] as const,
  pending: (sellerId: string) => [...sellerKeys.listings(sellerId), "corrections", "pending"] as const,
  list: (sellerId: string, status: string) => [...sellerKeys.listings(sellerId), "corrections", "list", status] as const,
  forListing: (sellerId: string, listingId: string) => [...sellerKeys.listings(sellerId), "corrections", "listing", listingId] as const,
  one: (sellerId: string, correctionId: string) => [...sellerKeys.listings(sellerId), "corrections", "one", correctionId] as const,
};

/** There's no notification inbox for corrections (E5-D6): this list is how sellers find them. */
export function usePendingCorrections(sellerId: string) {
  return useQuery({
    queryKey: correctionKeys.pending(sellerId),
    queryFn: ({ signal }) => sellerListingsService.corrections(sellerId, { status: "AWAITING_SELLER_DECISION", page: 1, pageSize: 100 }, signal),
    staleTime: 30_000,
  });
}

export const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description: "Description",
  condition: "Condition",
  grade: "Grade",
  price: "Price",
  quantity: "Quantity in stock",
  media: "Photos & documents",
};

export const STATUS_LABEL: Record<CorrectionStatus, string> = {
  AWAITING_SELLER_DECISION: "Needs your decision",
  READY_FOR_MODERATION: "Going to review",
  SELLER_ACCEPTED: "Accepted",
  SUBMITTED_TO_MODERATION: "In review",
  SELLER_DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  return <StatusBadge value={status} label={STATUS_LABEL[status] ?? status} />;
}

function Value({ field, value, names }: { field: string; value: string | null; names: Map<string, string> }) {
  if (value === null || value === "") return <span className="text-muted-foreground">Not set</span>;
  if (field === "condition" || field === "grade") return <>{names.get(value.toLowerCase()) ?? "Changed"}</>;
  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}

/** Your listing vs what the inspector proposes. Price, grade and quantity need your OK. */
export function CorrectionChanges({ changes, categoryId }: { changes: CorrectionFieldComparisonDto[]; categoryId?: string | null }) {
  const req = useListingRequirements(categoryId);
  const names = new Map<string, string>();
  for (const c of req.data?.conditionRules.conditions ?? []) {
    names.set(c.conditionId.toLowerCase(), c.name);
    for (const g of c.grades) names.set(g.gradeId.toLowerCase(), g.name);
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Your listing and the proposed changes</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">What</th>
            <th className="py-2 pr-3 font-medium">Your listing now</th>
            <th className="py-2 pr-3 font-medium">Proposed</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.field} className={c.requiresSellerAcceptance ? "border-b border-border bg-warning-soft/40" : "border-b border-border"}>
              <th scope="row" className="py-2.5 pr-3 text-left align-top font-medium text-foreground">
                {FIELD_LABEL[c.field] ?? c.field}
              </th>
              <td className="py-2.5 pr-3 align-top text-muted-foreground">
                <Value field={c.field} value={c.before} names={names} />
              </td>
              <td className="py-2.5 pr-3 align-top font-medium text-foreground">
                <Value field={c.field} value={c.after} names={names} />
              </td>
              <td className="py-2.5 align-top text-xs text-warning-soft-foreground">{c.requiresSellerAcceptance ? "Needs your OK" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Listing workspace: points at an inspector proposal waiting for this seller. */
export function ListingCorrectionsBanner({ sellerId, listingId }: { sellerId: string; listingId: string }) {
  const pending = usePendingCorrections(sellerId);
  const mine = (pending.data?.items ?? []).filter((c) => c.listingId === listingId);
  if (mine.length === 0) return null;
  const c = mine[0]!;
  return (
    <Notice
      tone="warning"
      title="An inspector proposed changes to this listing"
      className="mb-4"
      action={
        <Button asChild variant="primary" size="sm">
          <Link to={`/seller/listings/${listingId}/corrections/${c.correctionId}`}>
            <NotePencilIcon /> Review proposal
          </Link>
        </Button>
      }
    >
      {c.sellerVisibleSummary}
    </Notice>
  );
}

/** Listings page: how many proposals are waiting overall. */
export function PendingCorrectionsNotice({ sellerId }: { sellerId: string }) {
  const pending = usePendingCorrections(sellerId);
  const n = pending.data?.totalCount ?? 0;
  if (n === 0) return null;
  return (
    <Notice
      tone="warning"
      className="mb-4"
      title={n === 1 ? "1 inspector proposal needs your decision" : `${n} inspector proposals need your decision`}
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to="/seller/corrections">Review</Link>
        </Button>
      }
    >
      After an inspection, StockOut may propose corrections to a listing. Nothing changes until you accept and it's approved.
    </Notice>
  );
}
