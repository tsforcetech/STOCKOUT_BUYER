import * as React from "react";
import { CheckIcon, MinusIcon, PlusIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useSellerMode } from "@/lib/seller/seller-context";
import { toast } from "sonner";
import { useCart, clampQuantity } from "@/lib/cart/cart-context";
import { useServerCart } from "@/lib/cart/server-cart";
import { commerceErrorMessage } from "@/lib/cart/commerce-errors";
import { CART_LINE_LIMIT } from "@/api/types/buyer-commerce";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export interface AddToCartListing {
  listingId: string;
  sellerId: string;
  title: string;
  sellerName: string;
  basePrice: number | null;
  currency: string | null;
  unitSymbol: string | null;
  imageUrl: string | null;
  sellableQuantity: number;
  isAvailable: boolean;
}

/** True when the signed-in user belongs to the seller that owns this listing (sellers can't buy their own stock). */
export function useOwnListing(sellerId: string): boolean {
  const { sellers } = useSellerMode();
  return sellers.some((s) => s.sellerId.toLowerCase() === sellerId.toLowerCase());
}

/**
 * Adds a listing to the active cart (device cart when signed out, server cart when signed in), opens the mini cart,
 * and explains server refusals (minimum order, whole lot, own listing, 50-line limit, unavailable).
 */
export function useAddToCart(listing: AddToCartListing) {
  const cart = useCart();
  const [busy, setBusy] = React.useState(false);
  const limitReached = cart.mode === "server" && cart.count >= CART_LINE_LIMIT && !cart.has(listing.listingId);
  const add = async (quantity: number) => {
    if (limitReached) {
      toast.error(`Your cart already has ${CART_LINE_LIMIT} different items, the maximum. Remove or save one for later first.`);
      return false;
    }
    setBusy(true);
    try {
      await cart.add({
        listingId: listing.listingId,
        sellerId: listing.sellerId,
        title: listing.title,
        sellerName: listing.sellerName,
        unitPrice: listing.basePrice!,
        currency: listing.currency!,
        unitSymbol: listing.unitSymbol,
        imageUrl: listing.imageUrl,
        quantity,
        maxQuantity: listing.sellableQuantity,
      });
      cart.setOpen(true);
      return true;
    } catch (e) {
      toast.error(commerceErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { add, busy, limitReached };
}

/** Quantity in the active cart for this listing, if any. */
function useInCartQuantity(listingId: string): number | null {
  const cart = useCart();
  const server = useServerCart();
  if (cart.mode === "server") {
    const line = server.data?.sellerGroups.flatMap((g) => g.items).find((i) => i.listingId.toLowerCase() === listingId.toLowerCase());
    return line ? line.quantity : null;
  }
  return cart.items.find((i) => i.listingId === listingId)?.quantity ?? null;
}

/** Quantity stepper + "Add to cart" on the listing page. */
export function AddToCart({ listing }: { listing: AddToCartListing }) {
  const cart = useCart();
  const own = useOwnListing(listing.sellerId);
  const [qty, setQty] = React.useState(1);
  const [justAdded, setJustAdded] = React.useState(false);
  const inCartQty = useInCartQuantity(listing.listingId);
  const { add: addToCart, busy, limitReached } = useAddToCart(listing);
  const max = listing.sellableQuantity;
  const canBuy = listing.isAvailable && max > 0 && listing.basePrice !== null && listing.basePrice > 0 && !!listing.currency;
  const step = (d: number) => setQty((q) => clampQuantity(q + d, max));

  if (own) {
    return (
      <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">
        This is your own listing, so it can't be added to your cart.{" "}
        <Link to={`/seller/listings/${listing.listingId}`} className="font-medium text-foreground underline underline-offset-4">
          Manage it in the seller portal
        </Link>
      </p>
    );
  }

  if (!canBuy) {
    return <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">This listing can't be added to a cart right now (out of stock or no fixed price).</p>;
  }

  const add = async () => {
    if (await addToCart(qty)) {
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1400);
    }
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
            inputMode="numeric"
            step={1}
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
        <Button
          size="lg"
          className={cn("min-w-0 flex-1 transition-colors", justAdded && "bg-success text-white hover:bg-success")}
          onClick={() => void add()}
          loading={busy}
          disabled={limitReached}
          aria-live="polite"
        >
          {justAdded ? (
            <span key="added" className="inline-flex animate-fade-up items-center gap-2">
              <CheckIcon weight="bold" /> Added to cart
            </span>
          ) : (
            <>
              <ShoppingCartSimpleIcon /> Add to cart
            </>
          )}
        </Button>
      </div>
      <p className="mt-3 text-sm text-body">
        Total <span className="font-heading font-bold text-foreground">{formatMoney(listing.basePrice! * qty, listing.currency)}</span>
        <span className="text-muted-foreground">
          {" "}
          · {formatNumber(max)} {listing.unitSymbol ?? ""} available
        </span>
      </p>
      {limitReached && <p className="mt-2 text-sm text-warning-soft-foreground">Your cart has {CART_LINE_LIMIT} different items, the maximum. Remove or save one for later to add this.</p>}
      {inCartQty !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-success-soft-foreground">
          <CheckIcon className="size-4" /> {formatNumber(inCartQty)} {listing.unitSymbol ?? ""} in your cart ·{" "}
          <button type="button" onClick={() => cart.setOpen(true)} className="cursor-pointer underline underline-offset-4">
            View cart
          </button>
        </p>
      )}
    </div>
  );
}
