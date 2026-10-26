import { Link } from "react-router";
import type { SellerContextResponse } from "@/api/types/user-organization";
import { Button } from "@/components/ui/button";
import { useSellerEligibility } from "../lib/queries";
import { Notice } from "./notice";

/** Listing APIs require the OWNER of an ACTIVE seller (contract §1.2, defect D14). Explain before calls fail with 403. */
export function canManageListings(seller: SellerContextResponse): boolean {
  return seller.isOwner && seller.status === "ACTIVE";
}

export function ListingAccessNotice({ seller }: { seller: SellerContextResponse }) {
  if (!canManageListings(seller)) {
    return (
      <Notice tone="warning" title="Listings are locked for this seller account">
        {seller.status !== "ACTIVE"
          ? "This seller account is suspended. The marketplace only lets the owner of an active seller account read or change listings."
          : "You're a member, not the owner, of this seller account. The marketplace currently only lets the account owner read or change listings."}
      </Notice>
    );
  }
  return <ListingEligibilityNotice sellerId={seller.sellerId} />;
}

/**
 * PA-1B.1 listing eligibility (GET /sellers/{id}/eligibility). Drafts can still be prepared, but nothing goes live
 * until canList is true — say so up front, with the server's reason.
 */
export function ListingEligibilityNotice({ sellerId }: { sellerId: string }) {
  const eligibility = useSellerEligibility(sellerId);
  const e = eligibility.data;
  if (!e || e.canList) return null;
  return (
    <Notice
      tone="warning"
      title="Your listings can't go live yet"
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link to="/seller/business">Complete verification</Link>
        </Button>
      }
    >
      {e.reason ? `${e.reason} ` : ""}You can prepare drafts now; they can be published once your business is verified.
    </Notice>
  );
}
