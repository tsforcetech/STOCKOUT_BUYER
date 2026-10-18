import { Link, useNavigate } from "react-router";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ShoppingCartSimpleIcon, TrashIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { ListingImage } from "@/components/common/listing-image";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { QtyStepper, cartTotals, useLiveItems } from "./cart-shared";

/**
 * Mini cart that slides in from the right (header cart icon, and after "Add to cart").
 * Shoppers stay on the page they were browsing; "Continue" moves on to the full cart / checkout page.
 */
export function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const live = useLiveItems(cart.isOpen ? cart.items : []);
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

          {cart.items.length === 0 ? (
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
                          {item.sellerName} · {formatMoney(price, currency)}
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
