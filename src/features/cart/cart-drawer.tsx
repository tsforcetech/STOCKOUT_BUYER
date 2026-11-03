import { safeSellerLabel } from "@/lib/seller-code";
import { Link, useNavigate } from "react-router";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ShoppingCartSimpleIcon, TrashIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { useCartActions, useServerCart } from "@/lib/cart/server-cart";
import { ServerQty } from "./server-cart-page";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { QtyStepper, cartTotals, useLiveItems } from "./cart-shared";
import { RfqBanner } from "@/features/rfq/rfq-banner";

/**
 * Mini cart that slides in from the right (header cart icon, and after "Add to cart").
 * Shoppers stay on the page they were browsing; "Continue" moves on to the full cart / checkout page.
 */
export function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const server = useServerCart();
  const actions = useCartActions();
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
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                  {serverLines.map((item) => {
                    const unavailable = !item.isActive || !item.isPurchasable;
                    const group = server.data?.sellerGroups.find((g) => g.items.includes(item));
                    return (
                      <li key={item.listingId} className="flex gap-3 py-4">
                        <Link to={`/listings/${item.listingId}`} onClick={close} className="shrink-0">
                          <ListingImage src={assetUrl(item.thumbnailUrl)} alt={item.title} className="size-16 rounded-lg" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={`/listings/${item.listingId}`} onClick={close} className="line-clamp-2 text-sm font-bold leading-5 text-foreground hover:underline">
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
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <ServerQty size="sm" item={item} disabled={actions.isPending} onChange={(q) => actions.mutate({ kind: "quantity", listingId: item.listingId, quantity: q })} />
                              <span className="font-heading text-sm font-bold text-foreground">{formatMoney(item.lineSubtotal, item.currentCurrency)}</span>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={actions.isPending}
                          onClick={() => actions.mutate({ kind: "remove", listingId: item.listingId })}
                          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          aria-label={`Remove ${item.title}`}
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <footer className="border-t border-border px-5 py-4">
                  <RfqBanner
                    variant="compact"
                    className="mb-4"
                    beforeOpen={close}
                    options={{ source: "cart", context: "Missing items for this project? Add them here; your cart stays as it is." }}
                    title="Missing something for this project?"
                    body="Send one request for the rest. Sellers quote you."
                  />
                  {server.data && !server.data.checkoutReadiness.blockers.some((b) => b.code === "MIXED_CURRENCY_NOT_SUPPORTED") && (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-muted-foreground">Subtotal</span>
                        <span className="font-heading text-xl font-bold text-foreground">{formatMoney(server.data.totalSubtotal, server.data.currency)}</span>
                      </div>
                      {!server.data.checkoutReadiness.blockers.some((b) => b.code === "TAX_RATE_UNAVAILABLE") && (
                        <p className="mt-0.5 flex justify-between text-xs text-muted-foreground">
                          <span>Estimated VAT ({formatNumber(server.data.estimatedVatRatePercent)}%)</span>
                          <span>{formatMoney(server.data.estimatedVatAmount, server.data.currency)}</span>
                        </p>
                      )}
                    </>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(cart.count)} item{cart.count === 1 ? "" : "s"} · delivery and inspection agreed with the seller
                  </p>
                  <Button
                    size="lg"
                    className="mt-4 w-full"
                    onClick={() => {
                      close();
                      navigate("/cart");
                    }}
                  >
                    Continue
                  </Button>
                  <button type="button" onClick={close} className="mt-2 w-full cursor-pointer py-1 text-center text-sm text-foreground underline underline-offset-4">
                    Keep shopping
                  </button>
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
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                {cart.items.map((item) => {
                  const s = live.get(item.listingId);
                  const max = s?.max ?? item.maxQuantity;
                  const price = s?.price ?? item.unitPrice;
                  const currency = s?.currency ?? item.currency;
                  return (
                    <li key={item.listingId} className="flex gap-3 py-4">
                      <Link to={`/listings/${item.listingId}`} onClick={close} className="shrink-0">
                        <ListingImage src={item.imageUrl} alt={item.title} className="size-16 rounded-lg" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={`/listings/${item.listingId}`} onClick={close} className="line-clamp-2 text-sm font-bold leading-5 text-foreground hover:underline">
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
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <QtyStepper item={item} max={max} />
                            <span className="font-heading text-sm font-bold text-foreground">{formatMoney(price * Math.min(item.quantity, max), currency)}</span>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => cart.remove(item.listingId)} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${item.title}`}>
                        <TrashIcon className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <footer className="border-t border-border px-5 py-4">
                <RfqBanner
                  variant="compact"
                  className="mb-4"
                  beforeOpen={close}
                  options={{ source: "cart", context: "Missing items for this project? Add them here; your cart stays as it is." }}
                  title="Missing something for this project?"
                  body="Send one request for the rest. Sellers quote you."
                />
                {[...totals.entries()].map(([currency, total]) => (
                  <div key={currency} className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-heading text-xl font-bold text-foreground">{formatMoney(total, currency)}</span>
                  </div>
                ))}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(cart.count)} item{cart.count === 1 ? "" : "s"} · delivery and inspection agreed with the seller
                </p>
                <Button
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => {
                    close();
                    navigate("/cart");
                  }}
                >
                  Continue
                </Button>
                <button type="button" onClick={close} className="mt-2 w-full cursor-pointer py-1 text-center text-sm text-foreground underline underline-offset-4">
                  Keep shopping
                </button>
              </footer>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
