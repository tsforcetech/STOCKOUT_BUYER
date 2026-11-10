import * as React from "react";
import { useLeavingRows } from "./remove-with-undo";
import { cn } from "@/lib/utils/cn";
import { safeSellerLabel } from "@/lib/seller-code";
import { Link, useNavigate } from "react-router";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CaretDownIcon, ShoppingCartSimpleIcon, TrashIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { useCartActions, useServerCart } from "@/lib/cart/server-cart";
import { ServerQty } from "./server-cart-page";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { QtyStepper, cartTotals, useGuestRemove, useLiveItems, useServerRemove } from "./cart-shared";
import { RfqBanner } from "@/features/rfq/rfq-banner";
import { listingPath } from "@/lib/seo/site";

/**
 * Mini cart that slides in from the right (header cart icon, and after "Add to cart").
 * Shoppers stay on the page they were browsing; "Continue" moves on to the full cart / checkout page.
 */
export function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const server = useServerCart();
  const actions = useCartActions();
  const rows = useLeavingRows();
  const removeServer = useServerRemove(actions.mutate, rows.leave);
  const removeGuest = useGuestRemove(rows.leave);
  const serverLines = server.data?.sellerGroups.flatMap((g) => g.items) ?? [];
  const live = useLiveItems(cart.isOpen && cart.mode === "guest" ? cart.items : []);
  const totals = cartTotals(cart.items, live);
  const close = () => cart.setOpen(false);

  return (
    <DialogPrimitive.Root open={cart.isOpen} onOpenChange={cart.setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-surface shadow-raised focus:outline-none data-[state=open]:animate-[drawer-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]"
          aria-describedby={undefined}
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="flex items-center gap-2 font-heading text-xl font-bold text-foreground">
              <ShoppingCartSimpleIcon className="size-6" /> Your cart
              {cart.count > 0 && <span className="rounded-full bg-action px-2 py-0.5 text-xs text-action-foreground">{cart.count}</span>}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface-muted" aria-label="Close cart">
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </header>

          {cart.mode === "server" ? (
            serverLines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="font-heading text-lg font-bold text-foreground">{server.isLoading ? "Loading your cart…" : "Your cart is empty"}</p>
                {!server.isLoading && (
                  <Button asChild className="mt-5" onClick={close}>
                    <Link to="/search">Browse marketplace</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <ScrollList extra={<RfqRow close={close} />}>
                  {serverLines.map((item) => {
                    const unavailable = !item.isActive || !item.isPurchasable;
                    const group = server.data?.sellerGroups.find((g) => g.items.includes(item));
                    return (
                      <li key={item.listingId} className={cn("flex gap-3 py-3", rows.isLeaving(item.listingId) && "animate-row-out pointer-events-none")}>
                        <Link to={listingPath(item.listingId, item.title)} onClick={close} className="shrink-0">
                          <ListingImage src={assetUrl(item.thumbnailUrl)} alt={item.title} className="size-14 rounded-lg" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={listingPath(item.listingId, item.title)} onClick={close} className="line-clamp-2 text-sm font-bold leading-5 text-foreground hover:underline">
                            {item.title}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {group?.sellerDisplayName || "Verified seller"} · {formatMoney(item.currentPrice, item.currentCurrency)}
                          </p>
                          {item.hasPriceChanged && !unavailable && (
                            <p className="mt-1 text-xs text-warning-soft-foreground">Price changed from {formatMoney(item.addedPrice, item.addedCurrency)}</p>
                          )}
                          {!unavailable && !item.hasSufficientStock && <p className="mt-1 text-xs text-warning-soft-foreground">Only {formatNumber(item.stockAvailable)} available</p>}
                          {unavailable ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-danger-soft-foreground">
                              <WarningIcon className="size-3.5" /> {item.statusMessage || "No longer available"}
                            </p>
                          ) : (
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <ServerQty size="sm" item={item} disabled={actions.isPending} onChange={(q) => actions.mutate({ kind: "quantity", listingId: item.listingId, quantity: q })} />
                              <span className="font-heading text-sm font-bold text-foreground">{formatMoney(item.lineSubtotal, item.currentCurrency)}</span>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={actions.isPending}
                          onClick={() => removeServer(item)}
                          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          aria-label={`Remove ${item.title}`}
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ScrollList>
                <footer className="border-t border-border px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
                  {server.data && !server.data.checkoutReadiness.blockers.some((b) => b.code === "MIXED_CURRENCY_NOT_SUPPORTED") ? (
                    <Totals
                      label={server.data.checkoutReadiness.blockers.some((b) => b.code === "TAX_RATE_UNAVAILABLE") ? "Subtotal" : "Estimated total"}
                      amount={formatMoney(
                        server.data.checkoutReadiness.blockers.some((b) => b.code === "TAX_RATE_UNAVAILABLE") ? server.data.totalSubtotal : server.data.estimatedTotal,
                        server.data.currency,
                      )}
                      note={
                        server.data.checkoutReadiness.blockers.some((b) => b.code === "TAX_RATE_UNAVAILABLE")
                          ? `${formatNumber(cart.count)} item${cart.count === 1 ? "" : "s"}`
                          : `${formatNumber(cart.count)} item${cart.count === 1 ? "" : "s"} · incl. ${formatMoney(server.data.estimatedVatAmount, server.data.currency)} VAT (${formatNumber(server.data.estimatedVatRatePercent)}%)`
                      }
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Items in different currencies. See the cart for totals.</p>
                  )}
                  <FooterActions
                    onContinue={() => {
                      close();
                      navigate("/cart");
                    }}
                    onKeepShopping={close}
                  />
                </footer>
              </>
            )
          ) : cart.items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-cream">
                <ShoppingCartSimpleIcon className="size-8 text-foreground" />
              </span>
              <p className="mt-4 font-heading text-lg font-bold text-foreground">Your cart is empty</p>
              <p className="mt-1 text-sm text-body">Browse verified surplus stock and add what you need.</p>
              <Button asChild className="mt-5" onClick={close}>
                <Link to="/search">Browse marketplace</Link>
              </Button>
            </div>
          ) : (
            <>
              <ScrollList extra={<RfqRow close={close} />}>
                {cart.items.map((item) => {
                  const s = live.get(item.listingId);
                  const max = s?.max ?? item.maxQuantity;
                  const price = s?.price ?? item.unitPrice;
                  const currency = s?.currency ?? item.currency;
                  return (
                    <li key={item.listingId} className={cn("flex gap-3 py-3", rows.isLeaving(item.listingId) && "animate-row-out pointer-events-none")}>
                      <Link to={listingPath(item.listingId, item.title)} onClick={close} className="shrink-0">
                        <ListingImage src={item.imageUrl} alt={item.title} className="size-14 rounded-lg" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={listingPath(item.listingId, item.title)} onClick={close} className="line-clamp-2 text-sm font-bold leading-5 text-foreground hover:underline">
                          {item.title}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {safeSellerLabel(item.sellerName)} · {formatMoney(price, currency)}
                          {item.unitSymbol ? ` / ${item.unitSymbol}` : ""}
                        </p>
                        {s?.unavailable ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-danger-soft-foreground">
                            <WarningIcon className="size-3.5" /> No longer available
                          </p>
                        ) : (
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <QtyStepper item={item} max={max} />
                            <span className="font-heading text-sm font-bold text-foreground">{formatMoney(price * Math.min(item.quantity, max), currency)}</span>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => removeGuest(item)} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${item.title}`}>
                        <TrashIcon className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ScrollList>

              <footer className="border-t border-border px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
                {[...totals.entries()].map(([currency, total], i) => (
                  <Totals
                    key={currency}
                    label={i === 0 ? "Subtotal" : `Subtotal (${currency})`}
                    amount={formatMoney(total, currency)}
                    note={i === totals.size - 1 ? `${formatNumber(cart.count)} item${cart.count === 1 ? "" : "s"} · VAT added at checkout` : undefined}
                  />
                ))}
                <FooterActions
                  onContinue={() => {
                    close();
                    navigate("/cart");
                  }}
                  onKeepShopping={close}
                />
              </footer>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Scrollable item list with a fade and a "+N more" hint when items are hidden below; extra content scrolls with it. */
function ScrollList({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  const ref = React.useRef<HTMLUListElement>(null);
  const [hidden, setHidden] = React.useState(0);
  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const bottom = el.getBoundingClientRect().bottom;
    const rows = Array.from(el.querySelectorAll<HTMLElement>(":scope > li[data-cart-row]"));
    setHidden(rows.filter((r) => r.getBoundingClientRect().top + 24 > bottom).length);
  }, []);
  React.useEffect(() => {
    measure();
    const el = ref.current;
    el?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    return () => {
      el?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure]);
  React.useEffect(() => measure());
  return (
    <div className="relative min-h-0 flex-1">
      <ul ref={ref} className="h-full divide-y divide-border overflow-y-auto overscroll-contain px-5" aria-label="Cart items">
        {React.Children.map(children, (c) => (React.isValidElement(c) ? React.cloneElement(c as React.ReactElement<{ "data-cart-row"?: boolean }>, { "data-cart-row": true }) : c))}
        {extra && (
          <li data-cart-extra className="border-none py-4">
            {extra}
          </li>
        )}
      </ul>
      {hidden > 0 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" aria-hidden />
          <button
            type="button"
            onClick={() => ref.current?.scrollBy?.({ top: ref.current.clientHeight * 0.8, behavior: "smooth" })}
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-ink-foreground shadow-raised"
          >
            +{hidden} more item{hidden === 1 ? "" : "s"} <CaretDownIcon className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function RfqRow({ close }: { close: () => void }) {
  return (
    <RfqBanner
      variant="compact"
      beforeOpen={close}
      options={{ source: "cart", context: "Missing items for this project? Add them here; your cart stays as it is." }}
      title="Missing something for this project?"
      body="Send one request for the rest. Sellers quote you."
    />
  );
}

function Totals({ label, amount, note }: { label: string; amount: string; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-heading text-xl font-bold text-foreground">{amount}</span>
      </div>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function FooterActions({ onContinue, onKeepShopping }: { onContinue: () => void; onKeepShopping: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <button type="button" onClick={onKeepShopping} className="shrink-0 cursor-pointer px-1 py-3 text-sm text-foreground underline underline-offset-4">
        Keep shopping
      </button>
      <Button size="lg" className="min-w-0 flex-1" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
