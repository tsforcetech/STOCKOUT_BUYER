import type { SellerContextResponse } from "@/api/types/user-organization";
import { Notice } from "./notice";

/** Listing APIs require the OWNER of an ACTIVE seller (contract §1.2, defect D14). Explain before calls fail with 403. */
export function canManageListings(seller: SellerContextResponse): boolean {
  return seller.isOwner && seller.status === "ACTIVE";
}

export function ListingAccessNotice({ seller }: { seller: SellerContextResponse }) {
  if (canManageListings(seller)) return null;
  return (
    <Notice tone="warning" title="Listings are locked for this seller account">
      {seller.status !== "ACTIVE"
        ? "This seller account is suspended. The marketplace only lets the owner of an active seller account read or change listings."
        : "You're a member, not the owner, of this seller account. The marketplace currently only lets the account owner read or change listings."}
    </Notice>
  );
}
