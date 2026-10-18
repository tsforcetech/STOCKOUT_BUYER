import { Link } from "react-router";
import { InfoIcon, ShoppingCartSimpleIcon, StorefrontIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { ListingImage } from "@/components/common/listing-image";
import { Button } from "@/components/ui/button";
import { useCart, type CartItem } from "@/lib/cart/cart-context";
import { QtyStepper, cartTotals, useLiveItems } from "./cart-shared";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export default function CartPage() {
  const cart = useCart();
  const live = useLiveItems(cart.items);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-16 text-center sm:px-6">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-cream">
          <ShoppingCartSimpleIcon className="size-8 text-foreground" />
        </span>
        <h1 className="mt-5 font-heading text-[28px] font-bold text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-sm text-body">Browse verified surplus stock and add what you need.</p>
        <Button asChild className="mt-6">
          <Link to="/search">Browse marketplace</Link>
        </Button>
      </div>
    );
  }

  const bySeller = new Map<string, CartItem[]>();
  for (const i of cart.items) bySeller.set(i.sellerName, [...(bySeller.get(i.sellerName) ?? []), i]);

  const totals = cartTotals(cart.items, live);

  return (
    <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
      <h1 className="font-heading text-[28px] font-bold text-foreground sm:text-[32px]">Cart</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {cart.items.length} item{cart.items.length === 1 ? "" : "s"} from {bySeller.size} seller{bySeller.size === 1 ? "" : "s"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {[...bySeller.entries()].map(([seller, items]) => (
            <section key={seller} className="overflow-hidden rounded-xl border border-border" aria-label={seller}>
              <header className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-3 text-sm font-medium text-foreground">
                <StorefrontIcon className="size-4" /> {seller}
              </header>
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const s = live.get(item.listingId)!;
                  const qty = Math.min(item.quantity, s.max);
                  return (
                    <li key={item.listingId} className="flex gap-4 p-4">
                      <Link to={`/listings/${item.listingId}`} className="shrink-0">
                        <ListingImage src={item.imageUrl} alt={item.title} className="size-20 rounded-lg sm:size-24" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={`/listings/${item.listingId}`} className="line-clamp-2 font-heading font-bold text-foreground hover:underline">
                          {item.title}
                        </Link>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {formatMoney(s.price, s.currency)}
                          {item.unitSymbol ? ` / ${item.unitSymbol}` : ""}
                        </p>
                        {s.unavailable && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-danger-soft-foreground">
                            <WarningIcon className="size-3.5" /> No longer available
                          </p>
                        )}
                        {!s.unavailable && s.priceChanged && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-warning-soft-foreground">
                            <InfoIcon className="size-3.5" /> Price changed from {formatMoney(item.unitPrice, item.currency)}
                          </p>
                        )}
                        {!s.unavailable && item.quantity > s.max && (
                          <p className="mt-1 text-xs text-warning-soft-foreground">
                            Only {formatNumber(s.max)} {item.unitSymbol ?? ""} left
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {!s.unavailable && <QtyStepper item={item} max={s.max} />}
                          <button type="button" onClick={() => cart.remove(item.listingId)} className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-danger">
                            <TrashIcon className="size-4" /> Remove
                          </button>
                        </div>
                      </div>
                      <p className="shrink-0 text-right font-heading font-bold text-foreground">{s.unavailable ? "—" : formatMoney(s.price * qty, s.currency)}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit rounded-xl border border-border p-5 lg:sticky lg:top-32">
          <h2 className="font-heading text-lg font-bold text-foreground">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {[...totals.entries()].map(([currency, total]) => (
              <div key={currency} className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal ({currency})</dt>
                <dd className="font-heading text-lg font-bold text-foreground">{formatMoney(total, currency)}</dd>
              </div>
            ))}
            <div className="flex justify-between text-muted-foreground">
              <dt>Delivery & inspection</dt>
              <dd>Agreed with seller</dd>
            </div>
          </dl>
          <Button size="lg" className="mt-5 w-full" disabled aria-describedby="checkout-note">
            Checkout
          </Button>
          <p id="checkout-note" className="mt-3 rounded-lg bg-cream p-3 text-xs leading-5 text-body">
            <span className="font-medium text-foreground">Online checkout is coming soon.</span> Ordering and payments open once StockOut's order and payment
            services go live. Your cart is saved on this device until then.
          </p>
          <button type="button" onClick={() => cart.clear()} className="mt-3 w-full cursor-pointer text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Clear cart
          </button>
        </aside>
      </div>
    </div>
  );
}
