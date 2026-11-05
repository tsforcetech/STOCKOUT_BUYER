import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  BankIcon,
  BuildingsIcon,
  CheckCircleIcon,
  CreditCardIcon,
  LockSimpleIcon,
  MoneyIcon,
  PackageIcon,
  StorefrontIcon,
  TruckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { ErrorState } from "@/components/feedback/states";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { useServerCart } from "@/lib/cart/server-cart";
import { isApiError } from "@/lib/api/errors";
import { marketplaceService } from "@/services/marketplace.service";
import { useAuth } from "@/lib/auth/auth-context";
import { DENIED, useBuyerEligibility } from "@/features/cart/components/buyer-eligibility";
import { BLOCKER_TEXT, blockerText } from "@/features/cart/blockers";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils/format";
import { listingPath } from "@/lib/seo/site";
import { cn } from "@/lib/utils/cn";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import type { BuyerProfileDto } from "@/api/types/user-organization";
import { ORDER_API } from "@/lib/orders/order-api";

/**
 * Stage 8B.2 checkout review. Everything shown comes from the backend (cart, eligibility, buyer profile); no total is
 * calculated here. Delivery and payment are layout-only (UI ONLY tier) and placing an order stays disabled: there is
 * no order-placement endpoint (POST /api/v1/orders/checkout is policy blocked, CR-01).
 */

export const PLACE_ORDER_NOTE = "Placing orders isn't open yet. Online checkout and payment are being finalised and will open at launch. Nothing is charged and no order is created.";

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

function BuyerSection() {
  const elig = useBuyerEligibility();
  const profile = useBuyerProfile();
  const e = elig.data;
  const canBuy = !!e && e.canPurchase && e.eligible;
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
              : elig.error
                ? DENIED.UNAVAILABLE
                : // Known statuses get shopper wording; backend reasons can be internal (e.g. service configuration).
                  (DENIED[(e?.verificationStatus ?? "").toUpperCase()] ?? "Your account can't buy right now. Contact StockOut support.")}

          </span>
        </p>
      )}

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
              <BuildingsIcon className="size-4" aria-hidden /> No business details on file
            </p>
            <p className="mt-1 text-muted-foreground">Your company's legal name, trade licence and TRN will appear here. They're needed on invoices when ordering opens.</p>
          </div>
        ) : profile.error ? (
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
        ) : p ? (
          <BusinessDetails p={p} />
        ) : null}
      </div>
    </section>
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

function ItemsSection({ cart }: { cart: BuyerCartResponse }) {
  const lineBlocker = (listingId: string) => cart.checkoutReadiness.blockers.find((b) => b.listingId?.toLowerCase() === listingId.toLowerCase());
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
              <p className="shrink-0 text-sm text-muted-foreground">{formatMoney(g.groupSubtotal, cart.currency)}</p>
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
                      {blocker && <p className="mt-1 text-xs text-danger-soft-foreground">{blockerText(blocker)}</p>}
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

const PAYMENT = [
  { id: "card", icon: CreditCardIcon, label: "Card" },
  { id: "bank", icon: BankIcon, label: "Bank transfer" },
  { id: "cheque", icon: MoneyIcon, label: "Corporate cheque" },
];

function PaymentSection() {
  const [tab, setTab] = React.useState("card");
  return (
    <section className={sectionCls} aria-labelledby="co-payment">
      <SectionTitle id="co-payment" n={4} title="Payment" tag={<Badge tone="neutral">Preview</Badge>} />
      <div role="tablist" aria-label="Payment method" className="inline-flex flex-wrap gap-1 rounded-full bg-surface-muted p-1">
        {PAYMENT.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm transition", tab === id ? "bg-surface font-bold text-foreground shadow-raised" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-border-strong p-4 text-sm">
        <LockSimpleIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-body">
          {tab === "card"
            ? "Secure card payment opens at launch. No card details are collected on this page."
            : tab === "bank"
              ? "Bank transfer instructions will be shown when ordering opens."
              : "Corporate cheque payments will be available when ordering opens."}
        </p>
      </div>
    </section>
  );
}

function OrderSummary({ cart }: { cart: BuyerCartResponse }) {
  const blockers = cart.checkoutReadiness.blockers;
  const codes = new Set(blockers.map((b) => b.code));
  const mixed = codes.has("MIXED_CURRENCY_NOT_SUPPORTED");
  const noTax = codes.has("TAX_RATE_UNAVAILABLE");
  const general = blockers.filter((b) => !b.listingId);
  return (
    <aside className="h-fit rounded-2xl border border-border bg-surface p-5 shadow-raised lg:sticky lg:top-[176px]" aria-label="Order summary">
      <h2 className="font-heading text-lg font-bold text-foreground">Order summary</h2>
      {mixed ? (
        <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">{BLOCKER_TEXT.MIXED_CURRENCY_NOT_SUPPORTED}</p>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal ({formatNumber(cart.totalQuantity)} units)</dt>
            <dd className="font-medium text-foreground">{formatMoney(cart.totalSubtotal, cart.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{noTax ? "Estimated UAE VAT" : `Estimated UAE VAT (${formatNumber(cart.estimatedVatRatePercent)}%)`}</dt>
            <dd className="text-foreground">{noTax ? "Not available" : formatMoney(cart.estimatedVatAmount, cart.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-muted-foreground">Calculated at checkout</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-medium text-foreground">Estimated total</dt>
            <dd className="font-heading text-xl font-bold text-foreground">{noTax ? "—" : formatMoney(cart.estimatedTotal, cart.currency)}</dd>
          </div>
        </dl>
      )}

      <div className="mt-4" aria-label="Checkout readiness">
        {cart.checkoutReadiness.canProceed ? (
          <p className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-xs leading-5 text-success-soft-foreground">
            <CheckCircleIcon className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden /> Your cart passes every checkout check.
          </p>
        ) : (
          <ul className="space-y-2">
            {general.map((b) => (
              <li key={b.code} className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-soft-foreground">
                {blockerText(b)}
              </li>
            ))}
            {blockers.some((b) => b.listingId) && <li className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-soft-foreground">Some items need attention. See the notes on those items.</li>}
          </ul>
        )}
      </div>

      <Button size="lg" className="mt-4 w-full rounded-full" disabled={!ORDER_API.placeOrder} aria-describedby="place-order-note">
        <LockSimpleIcon /> Place order
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
  // The rowVersion the buyer is reviewing. If a refetch brings a different one, the cart changed elsewhere.
  const [reviewed, setReviewed] = React.useState<{ rowVersion: string; cart: BuyerCartResponse } | null>(null);
  React.useEffect(() => {
    if (q.data && !reviewed) setReviewed({ rowVersion: q.data.rowVersion, cart: q.data });
  }, [q.data, reviewed]);

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

  const changed = q.data.rowVersion !== reviewed.rowVersion;
  const cart = reviewed.cart;

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
      {changed && <ChangedNotice onReload={() => setReviewed({ rowVersion: q.data.rowVersion, cart: q.data })} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <BuyerSection />
          <ItemsSection cart={cart} />
          <DeliverySection />
          <PaymentSection />
        </div>
        <OrderSummary cart={cart} />
      </div>
    </div>
  );
}
