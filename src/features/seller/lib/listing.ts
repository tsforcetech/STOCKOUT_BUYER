import type { ListingStatus, PricingMode, SellerListingListItemResponse, SellerListingSort } from "@/api/types/seller-listings";

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Live",
  SUSPENDED: "Paused / suspended",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
};

type ListItem = Pick<SellerListingListItemResponse, "status" | "currentDraftVersionStatus">;

/**
 * Status pills on the seller's listings page. The list API only filters by the listing status, so the version
 * states (in review, changes requested, approved…) are matched in the browser.
 */
export const LISTING_VIEWS: Array<{ key: string; label: string; match: (l: ListItem) => boolean; needsAction?: boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "draft", label: "Drafts", match: (l) => l.status === "DRAFT" && (!l.currentDraftVersionStatus || l.currentDraftVersionStatus === "DRAFT") },
  { key: "review", label: "In review", match: (l) => l.currentDraftVersionStatus === "UNDER_REVIEW" },
  { key: "changes", label: "Changes requested", match: (l) => l.currentDraftVersionStatus === "CHANGES_REQUIRED", needsAction: true },
  { key: "inspection", label: "Awaiting inspection", match: (l) => l.currentDraftVersionStatus === "INSPECTION_REQUIRED" },
  { key: "approved", label: "Approved", match: (l) => l.currentDraftVersionStatus === "APPROVED" },
  { key: "live", label: "Live", match: (l) => l.status === "PUBLISHED" },
  { key: "paused", label: "Paused / suspended", match: (l) => l.status === "SUSPENDED" },
  { key: "rejected", label: "Rejected", match: (l) => l.currentDraftVersionStatus === "REJECTED" },
  { key: "expired", label: "Expired", match: (l) => l.status === "EXPIRED" },
  { key: "archived", label: "Archived", match: (l) => l.status === "ARCHIVED" },
];

const VERSION_LABELS: Record<string, string> = {
  UNDER_REVIEW: "In review",
  CHANGES_REQUIRED: "Changes requested",
  INSPECTION_REQUIRED: "Awaiting inspection",
  APPROVED: "Approved · going live soon",
  REJECTED: "Rejected",
};

/** One badge for "where is this listing now": the version state when it says more than the listing status. */
export function listingState(l: ListItem): { value: string; label: string } {
  const v = l.currentDraftVersionStatus;
  if (l.status === "PUBLISHED" && v && VERSION_LABELS[v]) return { value: v, label: `Live · update ${VERSION_LABELS[v]!.toLowerCase()}` };
  if (l.status === "DRAFT" && v && VERSION_LABELS[v]) return { value: v, label: VERSION_LABELS[v]! };
  return { value: l.status, label: LISTING_STATUS_LABELS[l.status] ?? l.status };
}

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  FIXED_PRICE: "Fixed price",
  BIDDING: "Bidding",
  BOTH: "Fixed price + bidding",
};

export const SORT_LABELS: Record<SellerListingSort, string> = {
  CreatedAtUtcDesc: "Newest first",
  CreatedAtUtcAsc: "Oldest first",
  TitleAsc: "Title A–Z",
  TitleDesc: "Title Z–A",
};

/** All-zero GUID returned by moderation-status when there is no draft. */
export const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

/** "2026-10-17" (date input) → "2026-10-17T00:00:00Z". */
export function dateInputToUtcIso(value: string | null | undefined): string | null {
  return value ? `${value}T00:00:00Z` : null;
}

/** ISO/UTC (with or without Z) → "yyyy-MM-dd" for a date input. */
export function isoToDateInput(value: string | null | undefined): string {
  if (!value || value.startsWith("0001-01-01")) return "";
  return value.slice(0, 10);
}

/** Positive/zero decimal with up to `places` decimals. */
export function decimalPattern(places: number, allowSign = false): RegExp {
  return new RegExp(`^${allowSign ? "[-+]?" : ""}\\d+(\\.\\d{1,${places}})?$`);
}
