import * as React from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { CheckIcon, MinusIcon, PlusIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useCart, clampQuantity } from "@/lib/cart/cart-context";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export interface AddToCartListing {
  listingId: string;
  title: string;
  sellerName: string;
  basePrice: number | null;
  currency: string | null;
  unitSymbol: string | null;
  imageUrl: string | null;
  sellableQuantity: number;
  isAvailable: boolean;
}

/** Quantity stepper + "Add to cart" on the listing page. */
export function AddToCart({ listing }: { listing: AddToCartListing }) {
  const cart = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = React.useState(1);
  const inCart = cart.items.find((i) => i.listingId === listing.listingId);
  const max = listing.sellableQuantity;
  const canBuy = listing.isAvailable && max > 0 && listing.basePrice !== null && listing.basePrice > 0 && !!listing.currency;
  const step = (d: number) => setQty((q) => clampQuantity(q + d, max));

  if (!canBuy) {
    return <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">This listing can't be added to a cart right now (out of stock or no fixed price).</p>;
  }

  const add = () => {
    cart.add({
      listingId: listing.listingId,
      title: listing.title,
      sellerName: listing.sellerName,
      unitPrice: listing.basePrice!,
      currency: listing.currency!,
      unitSymbol: listing.unitSymbol,
      imageUrl: listing.imageUrl,
      quantity: qty,
      maxQuantity: max,
    });
    toast.success("Added to cart", { action: { label: "View cart", onClick: () => navigate("/cart") } });
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 items-center rounded-full border border-border-strong" role="group" aria-label="Quantity">
          <button type="button" onClick={() => step(-1)} disabled={qty <= 1} className="flex size-11 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40" aria-label="Decrease quantity">
            <MinusIcon className="size-4" />
          </button>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={max}
            value={qty}
            onChange={(e) => setQty(clampQuantity(Number(e.target.value), max))}
            aria-label="Quantity"
            className="w-16 bg-transparent text-center font-medium text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" onClick={() => step(1)} disabled={qty >= max} className="flex size-11 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40" aria-label="Increase quantity">
            <PlusIcon className="size-4" />
          </button>
        </div>
        <Button size="lg" className="min-w-0 flex-1" onClick={add}>
          <ShoppingCartSimpleIcon /> Add to cart
        </Button>
      </div>
      <p className="mt-3 text-sm text-body">
        Total <span className="font-heading font-bold text-foreground">{formatMoney(listing.basePrice! * qty, listing.currency)}</span>
        <span className="text-muted-foreground">
          {" "}
          · {formatNumber(max)} {listing.unitSymbol ?? ""} available
        </span>
      </p>
      {inCart && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-success-soft-foreground">
          <CheckIcon className="size-4" /> {formatNumber(inCart.quantity)} {listing.unitSymbol ?? ""} in your cart ·{" "}
          <Link to="/cart" className="underline underline-offset-4">
            View cart
          </Link>
        </p>
      )}
    </div>
  );
}
