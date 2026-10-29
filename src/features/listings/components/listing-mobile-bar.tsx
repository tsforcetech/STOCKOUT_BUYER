import * as React from "react";
import { ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useOwnListing, type AddToCartListing } from "@/features/cart/add-to-cart";
import { useCart } from "@/lib/cart/cart-context";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Sticky price + add-to-cart bar for phones/tablets (< lg). It sits above the site's mobile tab bar
 * (h-16, < md) and hides itself while the full AddToCart panel (`panelRef`) is on screen, and once the
 * shopper has scrolled past the listing content (`endRef`), so it never duplicates or covers the footer.
 */
export function ListingMobileBar({
  listing,
  panelRef,
  endRef,
}: {
  listing: AddToCartListing;
  panelRef: React.RefObject<HTMLElement | null>;
  endRef: React.RefObject<HTMLElement | null>;
}) {
  const cart = useCart();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight;
      const panel = panelRef.current?.getBoundingClientRect();
      const end = endRef.current?.getBoundingClientRect();
      const panelInView = !!panel && panel.top < vh && panel.bottom > 0;
      const pastEnd = !!end && end.top < vh;
      setVisible(!panelInView && !pastEnd);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [panelRef, endRef]);

  const own = useOwnListing(listing.sellerId);
  const max = listing.sellableQuantity;
  const canBuy = !own && listing.isAvailable && max > 0 && listing.basePrice !== null && listing.basePrice > 0 && !!listing.currency;

  const addOne = () => {
    if (!canBuy) return;
    cart.add({
      listingId: listing.listingId,
      title: listing.title,
      sellerName: listing.sellerName,
      unitPrice: listing.basePrice!,
      currency: listing.currency!,
      unitSymbol: listing.unitSymbol,
      imageUrl: listing.imageUrl,
      quantity: 1,
      maxQuantity: max,
    });
    cart.setOpen(true);
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-raised backdrop-blur md:bottom-0 lg:hidden",
        !visible && "hidden",
      )}
    >
      <div className="mx-auto flex max-w-[760px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg font-bold leading-6 text-foreground">{formatMoney(listing.basePrice, listing.currency)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {own ? "Your listing" : canBuy ? (listing.unitSymbol ? `per ${listing.unitSymbol}` : "Fixed price") : "Not available to add right now"}
          </p>
        </div>
        {canBuy ? (
          <Button size="lg" className="h-11 shrink-0 px-5" onClick={addOne}>
            <ShoppingCartSimpleIcon /> Add 1 to cart
          </Button>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            className="h-11 shrink-0 rounded-full px-5"
            onClick={() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            See details
          </Button>
        )}
      </div>
    </div>
  );
}
