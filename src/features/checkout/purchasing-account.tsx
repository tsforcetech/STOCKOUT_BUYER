import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BuildingsIcon, UserIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useSellerMode } from "@/lib/seller/seller-context";
import { cartWrite } from "@/lib/cart/server-cart";
import { commerceCode, commerceErrorMessage } from "@/lib/cart/commerce-errors";
import { buyerCommerceService } from "@/services/buyer-commerce.service";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import type { BuyerEligibilityResponse, BuyerProfileDto } from "@/api/types/user-organization";

const ORG_ERRORS: Record<string, string> = {
  BUYER_ORGANIZATION_UNAUTHORIZED: "Your account isn't authorised to buy for that company. Ask your company's owner to check your role.",
  BUYER_ORGANIZATION_REQUIRED: "You buy as a business, so choose the company that is buying.",
  BUYER_IDENTITY_VERIFICATION_REQUIRED: "Verify your identity before choosing who is buying.",
  CART_CONCURRENCY_CONFLICT: "Your cart changed in another window. We've reloaded it; choose again.",
};

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * BE-01: who is buying. Options come only from the server's eligibility (organizationId + authorizedOrganizationIds);
 * nothing is preselected for business buyers, the buyer confirms explicitly and the server re-checks authority on
 * PUT /api/v1/buyer/cart/organization (If-Match = cart rowVersion). Individual buyers buy personally (null).
 */
export function PurchasingAccount({
  cart,
  eligibility,
  profile,
  onCartChanged,
}: {
  cart: BuyerCartResponse;
  eligibility: BuyerEligibilityResponse | undefined;
  profile: BuyerProfileDto | undefined;
  onCartChanged: (cart: BuyerCartResponse) => void;
}) {
  const qc = useQueryClient();
  const { sellers } = useSellerMode();
  const [choice, setChoice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

  if (!eligibility || !eligibility.canPurchase || !eligibility.organizationType) return null;
  const individual = eligibility.organizationType.toUpperCase() === "INDIVIDUAL";
  const orgIds = Array.from(new Set([eligibility.organizationId, ...(eligibility.authorizedOrganizationIds ?? [])].filter((x): x is string => !!x).map((x) => x.toLowerCase())));
  // A business buyer with no authorised company: nothing to choose; the readiness blocker explains it.
  if (!individual && orgIds.length === 0) return null;
  const label = (id: string) =>
    (same(id, profile?.organizationId) && (profile?.legalName || profile?.tradingName)) || sellers.find((s) => same(s.sellerId, id))?.displayName || `Company ${id.slice(0, 8).toUpperCase()}`;
  const current = cart.buyerOrganizationId ?? null;
  const currentValid = current ? orgIds.some((o) => same(o, current)) : individual;

  const save = async (organizationId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await cartWrite(qc, (rv) => buyerCommerceService.setOrganization(organizationId, rv));
      onCartChanged(updated);
      setEditing(false);
    } catch (e) {
      const code = commerceCode(e);
      setError((code && ORG_ERRORS[code]) || commerceErrorMessage(e));
      if (code === "CART_CONCURRENCY_CONFLICT") {
        const fresh = await qc.fetchQuery({ queryKey: ["buyer", "cart"], queryFn: () => buyerCommerceService.cart() });
        onCartChanged(fresh);
      }
    } finally {
      setBusy(false);
    }
  };

  // Who is buying, once settled: one plain row (the section title already says the account can buy).
  const settled = (name: string, sub: string, icon: React.ReactNode, change?: () => void) => (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted ring-1 ring-border" aria-hidden>
        {icon}
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="block text-xs text-muted-foreground">Buying for</span>
        <span className="block truncate font-heading text-base font-bold text-foreground">{name}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </p>
      {change && (
        <Button size="sm" variant="ghost" onClick={change}>
          Change
        </Button>
      )}
    </div>
  );
  const tradingAs = profile?.tradingName && profile.tradingName !== profile.legalName ? `Trading as ${profile.tradingName} · ` : "";

  // Individual with no company to choose: personal purchase needs no step.
  if (individual && orgIds.length === 0) return settled("Yourself", "Personal purchase. No company needed.", <UserIcon className="size-5" />);

  const chosen = currentValid && !editing;
  if (chosen) {
    const change = orgIds.length > 1 || individual ? () => (setChoice(current ? current.toLowerCase() : "personal"), setEditing(true)) : undefined;
    return current
      ? settled(label(current), `${same(current, profile?.organizationId) ? tradingAs : ""}Business purchase`, <BuildingsIcon className="size-5" />, change)
      : settled("Yourself", "Personal purchase", <UserIcon className="size-5" />, change);
  }

  const options: Array<{ value: string; title: string; icon: React.ReactNode }> = [
    ...(individual ? [{ value: "personal", title: "Myself (personal purchase)", icon: <UserIcon className="size-4" aria-hidden /> }] : []),
    ...orgIds.map((id) => ({ value: id, title: label(id), icon: <BuildingsIcon className="size-4" aria-hidden /> })),
  ];
  // A single company is shown as one clear button (still an explicit choice); several need a pick first.
  const single = options.length === 1 ? options[0] : null;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning-soft/40 p-4 text-sm" role="group" aria-labelledby="who-buys">
      <p id="who-buys" className="font-bold text-foreground">
        Who is buying?
      </p>
      <p className="mt-0.5 text-muted-foreground">{individual ? "Buy personally or for a company you're authorised to buy for." : "Choose the company this purchase is for. It appears on the order and invoice."}</p>
      {single ? (
        <Button className="mt-3" loading={busy} onClick={() => void save(single.value === "personal" ? null : single.value)}>
          {single.icon} Buy for {single.title}
        </Button>
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <label key={o.value} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border bg-surface p-3", choice === o.value ? "border-foreground ring-1 ring-foreground" : "border-border")}>
                <input type="radio" name="purchasing-account" className="accent-foreground" checked={choice === o.value} onChange={() => setChoice(o.value)} />
                {o.icon}
                <span className="font-medium text-foreground">{o.title}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button loading={busy} disabled={!choice} onClick={() => choice && void save(choice === "personal" ? null : choice)}>
              Confirm
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger-soft-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
