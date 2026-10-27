/**
 * StockOut is a B2B marketplace: buyers deal through the platform, so seller company names are never shown on the
 * buyer side. Each seller gets a stable public code from its id instead (e.g. "SO-3934B8"); the verified badge stays.
 */
export function sellerCode(sellerId: string | null | undefined): string {
  const hex = (sellerId ?? "").replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
  return hex ? `SO-${hex}` : "SO-······";
}

export function sellerLabel(sellerId: string | null | undefined): string {
  return `Seller ${sellerCode(sellerId)}`;
}

/** Saved carts/favourites from before seller names were hidden: never show the stored name. */
export function safeSellerLabel(stored: string | null | undefined): string {
  return stored && /^Seller SO-[0-9A-F·]{6}$/.test(stored) ? stored : "Verified seller";
}
