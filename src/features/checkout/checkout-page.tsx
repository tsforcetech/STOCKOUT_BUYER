import * as React from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  BuildingsIcon,
  CheckCircleIcon,
  CreditCardIcon,
  IdentificationCardIcon,
  LockSimpleIcon,
  PackageIcon,
  StorefrontIcon,
  TruckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { ErrorState } from "@/components/feedback/states";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { commerceKeys, useServerCart } from "@/lib/cart/server-cart";
import { isApiError } from "@/lib/api/errors";
import { marketplaceService } from "@/services/marketplace.service";
import { useAuth } from "@/lib/auth/auth-context";
import { DENIED, useBuyerEligibility } from "@/features/cart/components/buyer-eligibility";
import { BLOCKER_TEXT, blockerText, identityBlockerText } from "@/features/cart/blockers";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils/format";
import { listingPath } from "@/lib/seo/site";
import { cn } from "@/lib/utils/cn";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import type { BuyerProfileDto } from "@/api/types/user-organization";
import { ORDER_API } from "@/lib/orders/order-api";
import { orderKeys, ordersService } from "@/services/orders.service";
import { PurchasingAccount } from "./purchasing-account";
import type { CheckoutValidationResult, OrderLinePreviewDto } from "@/api/types/orders";

/**
 * Checkout review (Stage 8C). Totals, the seller breakdown, line issues and blockers come from
 * GET /api/v1/buyer/checkout/readiness (If-Match = the reviewed cart rowVersion); the cart supplies item details.
 * No total is calculated here. canProceed is not a payment or order authorisation: "Continue to payment" stays disabled
 * because there is no approved order-placement endpoint. Delivery and payment are layout previews only.
 */

export const PLACE_ORDER_NOTE = "Payment and placing orders aren't open yet; they open at launch. Nothing is charged and no order is created.";

const sectionCls = "rounded-2xl border border-border bg-surface p-5 sm:p-6";

function SectionTitle({ n, title, tag, id }: { n: number; title: string; tag?: React.ReactNode; id: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-surface">{n}</span>
      <h2 id={id} className="font-heading text-lg font-bold text-foreground">
        {title}
      </h2>
      {tag && <span className="ml-auto">{tag}</span>}
    </div>
  );
}

function useBuyerProfile() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["buyer", "profile"],
    queryFn: ({ signal }) => marketplaceService.buyerProfile(signal),
    enabled: status === "authenticated",
    retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 1,
    staleTime: 60_000,
  });
}

const TRN = /^\d{15}$/;

/** Account-level readiness blockers: checkout readiness is authoritative over the eligibility banner. */
const BUYER_BLOCKERS = ["BUYER_IDENTITY_VERIFICATION_REQUIRED", "BUYER_ORGANIZATION_REQUIRED", "BUYER_ORGANIZATION_UNAUTHORIZED", "MULTIPLE_ORGANIZATIONS", "COMMERCE_SELF_PURCHASE_DENIED"];

function BuyerSection({ readiness, cart, onCartChanged }: { readiness: CheckoutValidationResult | undefined; cart: BuyerCartResponse; onCartChanged: (cart: BuyerCartResponse) => void }) {
  const elig = useBuyerEligibility();
  const profile = useBuyerProfile();
  const e = elig.data;
  const buyerBlocker = readiness?.blockers.find((b) => !b.listingId && BUYER_BLOCKERS.includes(b.code));
  const canBuy = !!e && e.canPurchase && e.eligible && !buyerBlocker;
  const p = profile.data;
  const notFound = isApiError(profile.error) && profile.error.code === "MARKETPLACE_BUYER_NOT_FOUND";
  return (
    <section className={sectionCls} aria-labelledby="co-buyer">
      <SectionTitle id="co-buyer" n={1} title="Buyer" />
      {elig.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <p role="status" className={cn("flex items-start gap-2 rounded-lg p-3 text-sm", canBuy ? "bg-success-soft text-success-soft-foreground" : "bg-warning-soft text-warning-soft-foreground")}>
          {canBuy ? <CheckCircleIcon className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden /> : <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            {canBuy
              ? "Your account is allowed to buy."
              : buyerBlocker
                ? buyerBlocker.code === "BUYER_IDENTITY_VERIFICATION_REQUIRED"
                  ? identityBlockerText(!!e && e.canPurchase && e.verificationStatus === "VERIFIED")
                  : blockerText(buyerBlocker)
                : elig.error
                ? DENIED.UNAVAILABLE
                : // Known statuses get shopper wording; backend reasons can be internal (e.g. service configuration).
                  (DENIED[(e?.verificationStatus ?? "").toUpperCase()] ?? "Your account can't buy right now. Contact StockOut support.")}

          </span>
        </p>
      )}

      {e?.organizationType && (
        <p className="mt-3 text-xs text-muted-foreground">
          Buying as {e.organizationType.toUpperCase() === "INDIVIDUAL" ? "an individual (no company needed)" : "a business"}
        </p>
      )}
      <PurchasingAccount cart={cart} eligibility={e} profile={profile.data ?? undefined} onCartChanged={onCartChanged} />
      <div className="mt-4">
        {profile.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : notFound ? (
          <div className="rounded-lg border border-dashed border-border-strong p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <IdentificationCardIcon className="size-4" aria-hidden /> Identity not verified yet
            </p>
            <p className="mt-1 text-muted-foreground">Purchasing needs one approved ID for the account holder.</p>
            <Button asChild size="sm" variant="secondary" className="mt-3">
              <Link to="/account/verification">Verify my identity</Link>
            </Button>
          </div>
        ) : profile.error ? (
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
        ) : p ? (
          <>
            <IdentityStatus p={p} />
            {(p.legalName || p.tradeLicenseNumber || p.taxRegistrationNumber) && <BusinessDetails p={p} />}
          </>
        ) : null}
      </div>
    </section>
  );
}

function IdentityStatus({ p }: { p: BuyerProfileDto }) {
  const verified = p.verificationStatus === "VERIFIED" && !p.requiresReverification;
  const label = p.requiresReverification
    ? "Verification required again"
    : verified
      ? "Identity verified"
      : p.verificationStatus === "SUBMITTED" || p.verificationStatus === "UNDER_REVIEW"
        ? "Identity under review"
        : p.verificationStatus === "REJECTED"
          ? "Identity verification not approved"
          : "Identity not verified yet";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <IdentificationCardIcon className="size-4" aria-hidden />
      <span className="font-medium text-foreground">{p.fullName || "Account holder"}</span>
      <Badge tone={verified ? "success" : "warning"}>{label}</Badge>
      {!verified && (
        <Link to="/account/verification" className="ml-auto text-sm underline underline-offset-4">
          {p.verificationStatus === "SUBMITTED" || p.verificationStatus === "UNDER_REVIEW" ? "View status" : "Verify my identity"}
        </Link>
      )}
    </div>
  );
}

function BusinessDetails({ p }: { p: BuyerProfileDto }) {
  const address = [p.addressLine1, p.addressLine2, p.city, p.stateOrEmirate, p.postalCode].filter(Boolean).join(", ");
  const trn = p.isVatRegistered && p.taxRegistrationNumber;
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Company</p>
        <p className="mt-1 font-heading font-bold text-foreground">{p.legalName || p.tradingName || "Name not provided"}</p>
        {p.tradingName && p.tradingName !== p.legalName && <p className="text-muted-foreground">Trading as {p.tradingName}</p>}
        <p className="mt-2 text-body">
          Trade licence {p.tradeLicenseNumber || "not provided"}
          {p.tradeLicenseExpiresAtUtc && <span className="text-muted-foreground"> · valid until {formatDate(p.tradeLicenseExpiresAtUtc)}</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {trn ? (
            <Badge tone={TRN.test(p.taxRegistrationNumber ?? "") ? "success" : "warning"}>TRN {p.taxRegistrationNumber}</Badge>
          ) : (
            <Badge tone="neutral">{p.hasVatDeclaration ? "Not VAT registered (declaration on file)" : "Not VAT registered"}</Badge>
          )}
          <Badge tone={p.verificationStatus === "VERIFIED" ? "success" : "warning"}>{p.verificationStatus.replace(/_/g, " ").toLowerCase()}</Badge>
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing & contact</p>
        <p className="mt-1 text-body">{address || "Registered address not provided"}</p>
        {(p.signatoryName || p.signatoryEmail) && (
          <p className="mt-2 text-body">
            {p.signatoryName}
            {p.signatoryAuthorityRole && <span className="text-muted-foreground"> · {p.signatoryAuthorityRole}</span>}
            {p.signatoryEmail && <span className="block text-muted-foreground">{p.signatoryEmail}</span>}
            {p.signatoryPhone && <span className="block text-muted-foreground">{p.signatoryPhone}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function ItemsSection({ cart, readiness }: { cart: BuyerCartResponse; readiness: CheckoutValidationResult | undefined }) {
  const same = (a: string | null | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();
  const lines = new Map<string, OrderLinePreviewDto>();
  readiness?.sellerSubOrders.forEach((g) => g.lines.forEach((l) => lines.set(l.listingId.toLowerCase(), l)));
  const groupOf = (sellerId: string) => readiness?.sellerSubOrders.find((g) => same(g.sellerId, sellerId));
  const lineBlocker = (listingId: string): { code: string; message: string } | undefined => {
    const l = lines.get(listingId.toLowerCase());
    if (l && !l.isPurchasable && l.blockerCode) return { code: l.blockerCode, message: l.blockerMessage ?? "" };
    return readiness?.blockers.find((b) => same(b.listingId, listingId));
  };
  return (
    <section className={sectionCls} aria-labelledby="co-items">
      <SectionTitle id="co-items" n={2} title="Items" tag={<span className="text-sm text-muted-foreground">{formatNumber(cart.itemCount)} items</span>} />
      <div className="space-y-4">
        {cart.sellerGroups.map((g) => (
          <div key={g.sellerId} className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                <StorefrontIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{g.sellerDisplayName || "Seller"}</span>
              </p>
              <p className="shrink-0 text-right text-sm text-muted-foreground">
                {groupOf(g.sellerId) ? (
                  <>
                    <span className="font-medium text-foreground">{formatMoney(groupOf(g.sellerId)?.groupTotal, readiness?.currency)}</span>
                    <span className="block text-xs">incl. VAT {formatMoney(groupOf(g.sellerId)?.groupVatAmount, readiness?.currency)}</span>
                  </>
                ) : (
                  formatMoney(g.groupSubtotal, cart.currency)
                )}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {g.items.map((i) => {
                const blocker = lineBlocker(i.listingId);
                return (
                  <li key={i.cartItemId} className="flex gap-3 p-4">
                    <Link to={listingPath(i.listingId, i.title)} className="shrink-0">
                      <ListingImage src={assetUrl(i.thumbnailUrl)} alt={i.title} className="size-14 rounded-lg" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-foreground">{i.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatNumber(i.quantity)} × {formatMoney(i.currentPrice, i.currentCurrency)}
                        {i.hasPriceChanged && <span className="text-warning-soft-foreground"> · price changed from {formatMoney(i.addedPrice, i.addedCurrency)}</span>}
                      </p>
                      {blocker && (
                        <p className="mt-1 text-xs text-danger-soft-foreground">
                          {blockerText(blocker)}{" "}
                          <Link to="/cart" className="font-medium underline underline-offset-2">
                            Fix in cart
                          </Link>
                        </p>
                      )}
                      {!blocker && i.statusMessage && <p className="mt-1 text-xs text-warning-soft-foreground">{i.statusMessage}</p>}
                    </div>
                    <p className="shrink-0 text-sm font-bold text-foreground">{formatMoney(i.lineSubtotal, i.currentCurrency)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <Link to="/cart" className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Edit cart
      </Link>
    </section>
  );
}

const DELIVERY = [
  { id: "FREIGHT", icon: TruckIcon, title: "Freight delivery", text: "Truck delivery to your site, for pallets and bulk lots." },
  { id: "PARCEL", icon: PackageIcon, title: "Parcel delivery", text: "Courier delivery for smaller items." },
  { id: "COLLECTION", icon: BuildingsIcon, title: "Collect from seller", text: "Pick up from the seller's warehouse." },
];

function DeliverySection() {
  const [choice, setChoice] = React.useState("FREIGHT");
  return (
    <section className={sectionCls} aria-labelledby="co-delivery-h">
      <SectionTitle id="co-delivery-h" n={3} title="Delivery" tag={<Badge tone="neutral">Preview</Badge>} />
      <fieldset>
        <legend id="co-delivery" className="sr-only">
          Delivery method (preview)
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {DELIVERY.map(({ id, icon: Icon, title, text }) => (
            <label key={id} className={cn("flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-sm transition", choice === id ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong")}>
              <span className="flex items-center gap-2">
                <input type="radio" name="delivery" value={id} checked={choice === id} onChange={() => setChoice(id)} className="accent-foreground" />
                <Icon className="size-4" aria-hidden />
                <span className="font-bold text-foreground">{title}</span>
              </span>
              <span className="text-muted-foreground">{text}</span>
              <span className="mt-1 text-xs font-medium text-foreground">Calculated at checkout</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-muted-foreground">Delivery options and charges are confirmed when ordering opens. Your choice here isn't saved.</p>
    </section>
  );
}

function PaymentSection() {
  return (
    <section className={sectionCls} aria-labelledby="co-payment">
      <SectionTitle id="co-payment" n={4} title="Payment" tag={<Badge tone="neutral">Preview</Badge>} />
      <div className="flex items-center gap-3 rounded-xl border border-border p-4 text-sm">
        <CreditCardIcon className="size-5 shrink-0 text-foreground" aria-hidden />
        <div>
          <p className="font-bold text-foreground">Card payment</p>
          <p className="text-muted-foreground">Secure card payment opens at launch. No card details are collected on this page.</p>
        </div>
      </div>
      {/* Stage 8B.4: mount point reserved for Stripe Elements. Nothing is mounted until payments are enabled. */}
      <div id="payment-element" data-state="disabled" className="hidden" aria-hidden />
    </section>
  );
}

function GeneralBlocker({ code, text }: { code: string; text: string }) {
  return (
    <li className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-soft-foreground">
      {text}
      {code === "BUYER_IDENTITY_VERIFICATION_REQUIRED" && (
        <Link to="/account/verification" className="mt-1 block font-medium underline underline-offset-2">
          Verify my identity
        </Link>
      )}
      {code === "CART_EMPTY" && (
        <Link to="/search" className="mt-1 block font-medium underline underline-offset-2">
          Browse marketplace
        </Link>
      )}
    </li>
  );
}

function OrderSummary({ readiness, loading, error, onRetry }: { readiness: CheckoutValidationResult | undefined; loading: boolean; error: unknown; onRetry: () => void }) {
  const r = readiness;
  const blockers = r?.blockers ?? [];
  const codes = new Set(blockers.map((b) => b.code));
  const mixed = codes.has("MIXED_CURRENCY_NOT_SUPPORTED");
  const noTax = codes.has("TAX_RATE_UNAVAILABLE");
  const general = blockers.filter((b) => !b.listingId);
  const account = general.filter((b) => BUYER_BLOCKERS.includes(b.code));
  const lineIssues = blockers.some((b) => b.listingId) || !!r?.sellerSubOrders.some((g) => g.lines.some((l) => !l.isPurchasable));
  return (
    <aside className="h-fit rounded-2xl border border-border bg-surface p-5 shadow-raised lg:sticky lg:top-[176px]" aria-label="Order summary">
      <h2 className="font-heading text-lg font-bold text-foreground">Order summary</h2>
      {loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-7 w-2/3" />
        </div>
      ) : !r ? (
        <div role="alert" className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <p>{isApiError(error) && error.code === "INVALID_IF_MATCH_HEADER" ? "Your cart couldn't be checked. Reload the page and try again." : "We couldn't check your cart for checkout right now."}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
            <ArrowsClockwiseIcon /> Try again
          </Button>
        </div>
      ) : mixed ? (
        <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">{BLOCKER_TEXT.MIXED_CURRENCY_NOT_SUPPORTED}</p>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Subtotal ({formatNumber(r.totalQuantity)} units, {formatNumber(r.totalDistinctItems)} item{r.totalDistinctItems === 1 ? "" : "s"})
            </dt>
            <dd className="font-medium text-foreground">{formatMoney(r.totalMaterialSubtotal, r.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{noTax ? "Estimated UAE VAT" : `Estimated UAE VAT (${formatNumber(r.applicableVatRatePercent)}%)`}</dt>
            <dd className="text-foreground">{noTax ? "Not available" : formatMoney(r.estimatedVatAmount, r.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-muted-foreground">Calculated at checkout</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-medium text-foreground">Estimated total</dt>
            <dd className="font-heading text-xl font-bold text-foreground">{noTax ? "—" : formatMoney(r.estimatedPayableTotal, r.currency)}</dd>
          </div>
        </dl>
      )}

      {r && (
        <div className="mt-4" aria-label="Checkout readiness">
          {r.canProceed ? (
            <p className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-xs leading-5 text-success-soft-foreground">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden /> Readiness confirmed. Ordering will be available in a later release.
            </p>
          ) : (
            <ul className="space-y-2">
              {account.length > 0 && (
                <li className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-soft-foreground">
                  Checkout is blocked for your account.{" "}
                  <a href="#co-buyer" className="font-medium underline underline-offset-2">
                    See Buyer
                  </a>
                </li>
              )}
              {general
                .filter((b) => !BUYER_BLOCKERS.includes(b.code))
                .map((b) => (
                  <GeneralBlocker key={b.code} code={b.code} text={blockerText(b)} />
                ))}
              {lineIssues && <li className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-soft-foreground">Some items need attention. See the notes on those items.</li>}
            </ul>
          )}
        </div>
      )}

      <Button size="lg" className="mt-4 w-full rounded-full" disabled={!ORDER_API.placeOrder} aria-describedby="place-order-note">
        <LockSimpleIcon /> Continue to payment
      </Button>
      <p id="place-order-note" className="mt-3 rounded-lg bg-cream p-3 text-xs leading-5 text-body">
        {PLACE_ORDER_NOTE}
      </p>
    </aside>
  );
}

/** Shown when the cart changed in another tab/device after this review was loaded. */
function ChangedNotice({ onReload }: { onReload: () => void }) {
  return (
    <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning-soft-foreground sm:flex-row sm:items-center">
      <WarningCircleIcon className="size-5 shrink-0" aria-hidden />
      <p className="flex-1">Your cart was updated in another session. Please reload to review current pricing and stock.</p>
      <Button size="sm" variant="secondary" onClick={onReload}>
        <ArrowsClockwiseIcon /> Reload
      </Button>
    </div>
  );
}

export default function CheckoutPage() {
  const q = useServerCart();
  const queryClient = useQueryClient();
  // The rowVersion the buyer is reviewing. If a refetch brings a different one, the cart changed elsewhere.
  const [reviewed, setReviewed] = React.useState<{ rowVersion: string; cart: BuyerCartResponse } | null>(null);
  React.useEffect(() => {
    if (q.data && !reviewed) setReviewed({ rowVersion: q.data.rowVersion, cart: q.data });
  }, [q.data, reviewed]);
  const readiness = useQuery({
    queryKey: orderKeys.readiness(reviewed?.rowVersion),
    queryFn: ({ signal }) => ordersService.checkoutReadiness(reviewed?.rowVersion, signal),
    enabled: !!reviewed && reviewed.cart.itemCount > 0,
    // 400/409 are answers, not glitches: never resend the same If-Match.
    retry: (n, e) => !(isApiError(e) && e.status >= 400 && e.status < 500) && n < 1,
    staleTime: 0,
  });

  if (q.isLoading || (q.data && !reviewed))
    return (
      <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-9 w-48" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  if (q.error || !q.data || !reviewed)
    return (
      <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );

  const changed = q.data.rowVersion !== reviewed.rowVersion || (isApiError(readiness.error) && readiness.error.code === "CART_CONCURRENCY_CONFLICT");
  const cart = reviewed.cart;
  const reload = () => {
    void q.refetch().then((r) => r.data && setReviewed({ rowVersion: r.data.rowVersion, cart: r.data }));
  };

  if (cart.itemCount === 0)
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-body">Add items to your cart to review them for checkout.</p>
        <Button asChild className="mt-6">
          <Link to="/search">Browse marketplace</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
      <Link to="/cart" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Back to cart
      </Link>
      <h1 className="mt-1 font-heading text-[28px] font-bold text-foreground sm:text-[32px]">Checkout</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Review your order. Prices, VAT and stock are confirmed by StockOut, not calculated in your browser.</p>
      {changed && <ChangedNotice onReload={reload} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <BuyerSection readiness={readiness.data} cart={cart} onCartChanged={(c) => (queryClient.setQueryData(commerceKeys.cart, c), setReviewed({ rowVersion: c.rowVersion, cart: c }))} />
          <ItemsSection cart={cart} readiness={readiness.data} />
          <DeliverySection />
          <PaymentSection />
        </div>
        <OrderSummary readiness={readiness.data} loading={readiness.isLoading} error={readiness.error} onRetry={() => void readiness.refetch()} />
      </div>
    </div>
  );
}
