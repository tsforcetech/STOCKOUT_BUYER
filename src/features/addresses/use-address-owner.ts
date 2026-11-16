import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { useSellerMode } from "@/lib/seller/seller-context";
import { useServerCart } from "@/lib/cart/server-cart";
import { marketplaceService } from "@/services/marketplace.service";
import { useBuyerEligibility } from "@/features/cart/components/buyer-eligibility";
import type { AddressOwner } from "@/services/addresses.service";

export interface OwnerOption {
  key: string;
  owner: AddressOwner;
  label: string;
}

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Whose address book to show. Options come only from the server's buyer eligibility: an INDIVIDUAL buyer gets their
 * personal book; companies come from organizationId + authorizedOrganizationIds. With one option it is used; with
 * several the cart's purchasing company is preferred, otherwise the buyer must pick (never a silent default).
 */
export function useAddressOwner() {
  const { status } = useAuth();
  const elig = useBuyerEligibility();
  const cart = useServerCart();
  const { sellers } = useSellerMode();
  const profile = useQuery({
    queryKey: ["buyer", "profile"],
    queryFn: ({ signal }) => marketplaceService.buyerProfile(signal),
    enabled: status === "authenticated",
    retry: false,
    staleTime: 60_000,
  });
  const e = elig.data;

  const options = React.useMemo<OwnerOption[]>(() => {
    if (!e?.organizationType) return [];
    const out: OwnerOption[] = [];
    if (e.organizationType.toUpperCase() === "INDIVIDUAL") out.push({ key: "me", owner: { kind: "individual" }, label: "My addresses" });
    const ids = Array.from(new Set([e.organizationId, ...(e.authorizedOrganizationIds ?? [])].filter((x): x is string => !!x).map((x) => x.toLowerCase())));
    for (const id of ids) {
      const p = profile.data;
      const label = (same(id, p?.organizationId) && (p?.legalName || p?.tradingName)) || sellers.find((s) => same(s.sellerId, id))?.displayName || `Company ${id.slice(0, 8).toUpperCase()}`;
      out.push({ key: id, owner: { kind: "organization", organizationId: id }, label });
    }
    return out;
  }, [e, profile.data, sellers]);

  const [picked, setPicked] = React.useState<string | null>(null);
  const cartOrg = cart.data?.buyerOrganizationId?.toLowerCase() ?? null;
  const selectedKey = picked ?? (options.length === 1 ? options[0].key : (options.find((o) => o.key === cartOrg)?.key ?? null));
  const selected = options.find((o) => o.key === selectedKey) ?? null;

  return { loading: elig.isLoading, error: elig.error, eligibility: e, options, selected, select: setPicked };
}
