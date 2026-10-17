import type { ListingStatus, PricingMode, SellerListingSort } from "@/api/types/seller-listings";

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Live",
  SUSPENDED: "Paused / suspended",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
};

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
