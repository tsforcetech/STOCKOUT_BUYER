import * as React from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import type { SellerContextResponse } from "@/api/types/user-organization";
import { Button } from "@/components/ui/button";
import { useSellerEligibility } from "../lib/queries";
import { Notice } from "./notice";

/** Listing APIs require the OWNER of an ACTIVE seller (contract §1.2, defect D14). Explain before calls fail with 403. */
export function canManageListings(seller: SellerContextResponse): boolean {
  return seller.isOwner && seller.status === "ACTIVE";
}

const RECHECK_MS = 60_000;

/**
 * A5-R1: while the seller is suspended, re-read the actor context (every minute, and when the tab regains focus)
 * so the portal unlocks by itself once an admin reinstates the account.
 */
export function useRecheckWhileSuspended(suspended: boolean) {
  const { reloadActor } = useAuth();
  const qc = useQueryClient();
  const [checking, setChecking] = React.useState(false);
  const check = React.useCallback(async () => {
    setChecking(true);
    try {
      await reloadActor();
      await qc.invalidateQueries();
    } finally {
      setChecking(false);
    }
  }, [reloadActor, qc]);
  React.useEffect(() => {
    if (!suspended) return;
    const t = window.setInterval(() => void reloadActor(), RECHECK_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") void reloadActor();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [suspended, reloadActor]);
  return { check, checking };
}

function SuspendedNotice() {
  const { check, checking } = useRecheckWhileSuspended(true);
  return (
    <Notice tone="warning" title="Your seller account is suspended">
      The marketplace team suspended this account, so listings can't be viewed or changed and they are hidden from buyers. Contact StockOut support for
      details. This page unlocks automatically once the account is reinstated.
      <div className="mt-2">
        <Button size="sm" variant="secondary" loading={checking} onClick={() => void check()}>
          Check again
        </Button>
      </div>
    </Notice>
  );
}

export function ListingAccessNotice({ seller }: { seller: SellerContextResponse }) {
  if (seller.isOwner && seller.status === "SUSPENDED") return <SuspendedNotice />;
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
