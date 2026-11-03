import * as React from "react";
import { Link } from "react-router";
import {
  ArrowCounterClockwiseIcon,
  BookmarkSimpleIcon,
  InfoIcon,
  LockSimpleIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartSimpleIcon,
  StorefrontIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useCart } from "@/lib/cart/cart-context";
import { useCartActions, useSavedItems, useServerCart } from "@/lib/cart/server-cart";
import { safeSellerLabel } from "@/lib/seller-code";
import { CART_LINE_LIMIT, type BuyerCartItemResponse, type BuyerCartResponse, type CheckoutBlockerDto } from "@/api/types/buyer-commerce";
import { RfqBanner } from "@/features/rfq/rfq-banner";
import { useGuestMerge } from "./merge-prompt";
import { commerceErrorMessage } from "@/lib/cart/commerce-errors";

/** Checkout-readiness blocker codes (stable) → shopper wording. The backend `message` is shown as detail. */
const BLOCKER_TEXT: Record<string, string> = {
  BUYER_IDENTITY_VERIFICATION_REQUIRED: "Verify your account before buying. You can keep adding to your cart in the meantime.",
  MULTIPLE_ORGANIZATIONS: "Your account belongs to more than one organisation. Choosing which one buys isn't available yet, so checkout is blocked. Contact StockOut support.",
  LISTING_UNAVAILABLE: "An item is no longer available. Remove it or save it for later.",
  INSUFFICIENT_STOCK: "An item has less stock than you asked for. Change the quantity.",
  COMMERCE_WHOLE_LOT_REQUIRED: "An item is sold as a whole lot only.",
  COMMERCE_MIN_ORDER_QTY_NOT_MET: "An item is below the seller's minimum order quantity.",
  MIXED_CURRENCY_NOT_SUPPORTED: "Your cart has items in different currencies, so it can't be totalled or checked out together.",
  TAX_RATE_UNAVAILABLE: "VAT can't be estimated right now. Your cart still works; checkout waits until it can.",
  CART_EMPTY: "Your cart is empty.",
};

const blockerText = (b: CheckoutBlockerDto) => BLOCKER_TEXT[b.code] ?? b.message;

function MergeBanner() {
  const cart = useCart();
  const { merge, busy, error } = useGuestMerge();
  if (cart.items.length === 0) return null;
  const n = cart.items.length;
  return (
    <div className="mb-6 rounded-2xl border border-action-border bg-action-soft p-4 text-sm text-foreground">
      <p className="font-medium">
        {n} item{n === 1 ? "" : "s"} you added before signing in {n === 1 ? "is" : "are"} saved on this device.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void merge()} loading={busy}>
          Add to my cart
        </Button>
        <Button size="sm" variant="ghost" onClick={() => cart.clear()} disabled={busy}>
          Discard them
        </Button>
      </div>
      {error ? <p className="mt-2 text-danger">{commerceErrorMessage(error)} They are still saved on this device.</p> : null}
    </div>
  );
}

export function ServerQty({ item, disabled, onChange, size = "md" }: { item: BuyerCartItemResponse; disabled: boolean; onChange: (q: number) => void; size?: "sm" | "md" }) {
  const sm = size === "sm";
  const [draft, setDraft] = React.useState(String(item.quantity));
  React.useEffect(() => setDraft(String(item.quantity)), [item.quantity]);
  const commit = () => {
    const q = Math.round(Number(draft));
    if (!Number.isFinite(q) || q < 1) return setDraft(String(item.quantity));
    if (q !== item.quantity) onChange(q);
  };
  return (
    <div className={cn("flex items-center rounded-full border border-border-strong", sm ? "h-9" : "h-10")} role="group" aria-label={`Quantity for ${item.title}`}>
      <button type="button" onClick={() => onChange(item.quantity - 1)} disabled={disabled || item.quantity <= 1} className={cn("flex cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40", sm ? "size-9" : "size-10")} aria-label="Decrease quantity">
        <MinusIcon className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        step={1}
        min={1}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        aria-label="Quantity"
        className="w-12 bg-transparent text-center text-base font-medium text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => onChange(item.quantity + 1)} disabled={disabled} className={cn("flex cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40", sm ? "size-9" : "size-10")} aria-label="Increase quantity">
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}

function CartLine({ item, blockers, busy, act }: { item: BuyerCartItemResponse; blockers: CheckoutBlockerDto[]; busy: boolean; act: ReturnType<typeof useCartActions>["mutate"] }) {
  const unavailable = !item.isActive || !item.isPurchasable;
  const href = `/listings/${item.listingId}`;
  return (
    <li className={cn("flex gap-3 p-4 sm:gap-4", unavailable && "bg-danger-soft/30")}>
      <Link to={href} className="shrink-0">
        <ListingImage src={assetUrl(item.thumbnailUrl)} alt={item.title} className={cn("size-20 rounded-lg sm:size-24", unavailable && "opacity-60")} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={href} className="line-clamp-2 font-heading font-bold text-foreground hover:underline">
          {item.title}
        </Link>
        <p className="mt-0.5 text-sm text-muted-foreground">{formatMoney(item.currentPrice, item.currentCurrency)} each</p>
        {item.hasPriceChanged && (
          <p className="mt-1 flex items-center gap-1 text-xs text-warning-soft-foreground">
            <InfoIcon className="size-3.5 shrink-0" /> Price changed from {formatMoney(item.addedPrice, item.addedCurrency)} to {formatMoney(item.currentPrice, item.currentCurrency)}
          </p>
        )}
        {unavailable ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-danger-soft-foreground">
            <WarningIcon className="size-3.5 shrink-0" /> {item.statusMessage || "No longer available. Remove it or save it for later."}
          </p>
        ) : !item.hasSufficientStock ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-warning-soft-foreground">
            <WarningIcon className="size-3.5 shrink-0" /> Only {formatNumber(item.stockAvailable)} available. Change the quantity to continue.
          </p>
        ) : null}
        {blockers
          .filter((b) => b.code !== "LISTING_UNAVAILABLE" && b.code !== "INSUFFICIENT_STOCK")
          .map((b) => (
            <p key={b.code} className="mt-1 flex items-center gap-1 text-xs text-warning-soft-foreground">
              <WarningIcon className="size-3.5 shrink-0" /> {b.message || blockerText(b)}
            </p>
          ))}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {!unavailable && <ServerQty item={item} disabled={busy} onChange={(q) => act({ kind: "quantity", listingId: item.listingId, quantity: q })} />}
          <button type="button" disabled={busy} onClick={() => act({ kind: "save", listingId: item.listingId })} className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
            <BookmarkSimpleIcon className="size-4" /> Save for later
          </button>
          <button type="button" disabled={busy} onClick={() => act({ kind: "remove", listingId: item.listingId })} className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-danger disabled:opacity-50">
            <TrashIcon className="size-4" /> Remove
          </button>
          <span className="ml-auto font-heading font-bold text-foreground sm:hidden">{unavailable ? "—" : formatMoney(item.lineSubtotal, item.currentCurrency)}</span>
        </div>
      </div>
      <p className="hidden shrink-0 text-right font-heading font-bold text-foreground sm:block">{unavailable ? "—" : formatMoney(item.lineSubtotal, item.currentCurrency)}</p>
    </li>
  );
}

function Summary({ cart, onClear, busy }: { cart: BuyerCartResponse; onClear: () => void; busy: boolean }) {
  const blockers = cart.checkoutReadiness.blockers.filter((b) => b.code !== "CART_EMPTY");
  const codes = new Set(blockers.map((b) => b.code));
  const mixed = codes.has("MIXED_CURRENCY_NOT_SUPPORTED");
  const noTax = codes.has("TAX_RATE_UNAVAILABLE");
  // Generic (cart-wide) blockers are listed here; item-specific ones are shown on their line.
  const general = blockers.filter((b) => !b.listingId);
  return (
    <aside className="h-fit rounded-2xl border border-border p-5 shadow-raised lg:sticky lg:top-[176px]">
      <h2 className="font-heading text-lg font-bold text-foreground">Summary</h2>
      {mixed ? (
        <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">{BLOCKER_TEXT.MIXED_CURRENCY_NOT_SUPPORTED}</p>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Subtotal ({formatNumber(cart.totalQuantity)} unit{cart.totalQuantity === 1 ? "" : "s"})
            </dt>
            <dd className="font-medium text-foreground">{formatMoney(cart.totalSubtotal, cart.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{noTax ? "Estimated VAT" : `Estimated VAT (${formatNumber(cart.estimatedVatRatePercent)}%)`}</dt>
            <dd className="text-foreground">{noTax ? "Not available" : formatMoney(cart.estimatedVatAmount, cart.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-medium text-foreground">Estimated total</dt>
            <dd className="font-heading text-xl font-bold text-foreground">{noTax ? formatMoney(cart.totalSubtotal, cart.currency) : formatMoney(cart.estimatedTotal, cart.currency)}</dd>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>Delivery & inspection</dt>
            <dd>Agreed with seller</dd>
          </div>
        </dl>
      )}

      <section aria-label="Checkout readiness" className="mt-4">
        {cart.checkoutReadiness.canProceed ? (
          <p className="rounded-lg bg-success-soft p-3 text-xs leading-5 text-success-soft-foreground">Your cart is ready for checkout.</p>
        ) : (
          <ul className="space-y-2">
            {general.map((b) => (
              <li key={b.code} className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-soft-foreground">
                <p>{blockerText(b)}</p>
                {b.code === "BUYER_IDENTITY_VERIFICATION_REQUIRED" && (
                  <Button asChild size="sm" variant="secondary" className="mt-2">
                    <Link to="/account">Verify my account</Link>
                  </Button>
                )}
              </li>
            ))}
            {blockers.some((b) => b.listingId) && <li className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning-soft-foreground">Some items need attention. See the notes on those items.</li>}
          </ul>
        )}
      </section>

      <Button size="lg" variant="secondary" className="mt-4 w-full rounded-full" disabled aria-describedby="checkout-note">
        <LockSimpleIcon /> Checkout · coming soon
      </Button>
      <p id="checkout-note" className="mt-3 rounded-lg bg-cream p-3 text-xs leading-5 text-body">
        <span className="font-medium text-foreground">Online checkout is coming soon.</span> Your cart is saved to your account. VAT shown is an estimate; the final amount
        is confirmed at checkout.
      </p>
      <button type="button" onClick={onClear} disabled={busy} className="mt-3 w-full cursor-pointer text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50">
        Clear cart
      </button>
    </aside>
  );
}

function SavedForLater() {
  const saved = useSavedItems();
  const actions = useCartActions();
  const items = saved.data?.items ?? [];
  if (saved.isLoading || items.length === 0) return null;
  return (
    <section aria-label="Saved for later" className="mt-10">
      <h2 className="font-heading text-xl font-bold text-foreground">Saved for later ({formatNumber(saved.data?.totalCount ?? items.length)})</h2>
      <p className="mt-1 text-sm text-muted-foreground">Not in your cart. Move them back when you're ready.</p>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {items.map((i) => (
          <li key={i.listingId} className="flex gap-3 p-4">
            <Link to={`/listings/${i.listingId}`} className="shrink-0">
              <ListingImage src={assetUrl(i.thumbnailUrl)} alt={i.title} className="size-16 rounded-lg" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/listings/${i.listingId}`} className="line-clamp-2 text-sm font-bold text-foreground hover:underline">
                {i.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatMoney(i.currentPrice, i.currency)} each · {formatNumber(i.quantity)} saved
                {i.currentPrice !== i.savedPrice && <> · was {formatMoney(i.savedPrice, i.currency)}</>}
              </p>
              {!i.isPurchasable && <p className="mt-0.5 text-xs text-danger-soft-foreground">Not available right now</p>}
              <div className="mt-2 flex flex-wrap gap-x-4">
                <button type="button" disabled={actions.isPending || !i.isPurchasable} onClick={() => actions.mutate({ kind: "restore", listingId: i.listingId })} className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                  <ArrowCounterClockwiseIcon className="size-4" /> Move to cart
                </button>
                <button type="button" disabled={actions.isPending} onClick={() => actions.mutate({ kind: "removeSaved", listingId: i.listingId })} className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-danger disabled:opacity-50">
                  <TrashIcon className="size-4" /> Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Signed-in cart (Stage 8A.2): the server cart is the source of truth for prices, stock, totals and readiness. */
export function ServerCartPage() {
  const q = useServerCart();
  const actions = useCartActions();
  const [confirmClear, setConfirmClear] = React.useState(false);
  const cart = q.data;

  if (q.isLoading)
    return (
      <div className="mx-auto max-w-[1336px] space-y-4 px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (q.error || !cart)
    return (
      <div className="mx-auto max-w-[760px] px-4 py-16 sm:px-6">
        <ErrorState error={q.error} title="We couldn't load your cart" onRetry={() => void q.refetch()} />
      </div>
    );

  const lines = cart.sellerGroups.reduce((n, g) => n + g.items.length, 0);
  const blockersFor = (listingId: string) => cart.checkoutReadiness.blockers.filter((b) => b.listingId?.toLowerCase() === listingId.toLowerCase());

  return (
    <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
      <MergeBanner />
      <h1 className="font-heading text-[28px] font-bold text-foreground sm:text-[32px]">Cart</h1>
      {lines === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong p-10 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-cream">
            <ShoppingCartSimpleIcon className="size-8 text-foreground" />
          </span>
          <p className="mt-4 font-heading text-lg font-bold text-foreground">Your cart is empty</p>
          <p className="mt-1 text-sm text-body">Browse verified surplus stock and add what you need.</p>
          <Button asChild className="mt-5">
            <Link to="/search">Browse marketplace</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(lines)} item{lines === 1 ? "" : "s"} from {cart.sellerGroups.length} seller{cart.sellerGroups.length === 1 ? "" : "s"}
            {lines >= CART_LINE_LIMIT && ` · the maximum of ${CART_LINE_LIMIT} items`}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              {cart.sellerGroups.map((g) => (
                <section key={g.sellerId} className="overflow-hidden rounded-2xl border border-border" aria-label={g.sellerDisplayName || safeSellerLabel("")}>
                  <header className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-4 py-3 text-sm font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      <StorefrontIcon className="size-4" /> {g.sellerDisplayName || "Verified seller"}
                    </span>
                    <span className="text-muted-foreground">{formatMoney(g.groupSubtotal, cart.currency)}</span>
                  </header>
                  <ul className="divide-y divide-border">
                    {g.items.map((item) => (
                      <CartLine key={item.listingId} item={item} blockers={blockersFor(item.listingId)} busy={actions.isPending} act={actions.mutate} />
                    ))}
                  </ul>
                </section>
              ))}
              <RfqBanner
                variant="inline"
                options={{ source: "cart", context: "Missing items for this project? Add them here; your cart stays as it is." }}
                title="Missing items for this project?"
                body="Add everything else to one request for quote, or upload your BOQ. Verified sellers quote you."
                cta="Get quotes for the missing items"
              />
            </div>
            <Summary cart={cart} busy={actions.isPending} onClear={() => setConfirmClear(true)} />
          </div>
        </>
      )}
      <SavedForLater />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear your cart?"
        description="All items are removed from your cart. Items saved for later stay."
        confirmLabel="Clear cart"
        loading={actions.isPending}
        onConfirm={() => actions.mutate({ kind: "clear" }, { onSettled: () => setConfirmClear(false) })}
      />
    </div>
  );
}
