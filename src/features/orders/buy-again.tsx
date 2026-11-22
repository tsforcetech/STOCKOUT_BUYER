import * as React from "react";
import { useNavigate } from "react-router";
import { ArrowsCounterClockwiseIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { commerceErrorMessage } from "@/lib/cart/commerce-errors";
import { assetUrl } from "@/components/common/listing-image";
import type { MarketplaceOrderDto } from "@/api/types/orders";

/**
 * Adds every item of a past order back to the cart (same quantities, today's prices and stock are checked by the
 * server), then opens the cart. Items that can't be added (sold out, below minimum, own listing) are reported.
 */
export function BuyAgain({ order }: { order: MarketplaceOrderDto }) {
  const cart = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const lines = order.subOrders.flatMap((s) => s.items.map((l) => ({ l, seller: s.sellerTradingName || s.sellerLegalName || "Seller" })));
  if (!lines.length) return null;

  const run = async () => {
    setBusy(true);
    const failed: string[] = [];
    for (const { l, seller } of lines) {
      try {
        await cart.add({
          listingId: l.listingId,
          sellerId: l.sellerId,
          title: l.titleSnapshot,
          sellerName: seller,
          unitPrice: l.unitPrice,
          currency: l.currency,
          unitSymbol: null,
          imageUrl: assetUrl(l.thumbnailUrlSnapshot),
          quantity: l.quantity,
          maxQuantity: Number.MAX_SAFE_INTEGER,
        });
      } catch (e) {
        failed.push(`${l.titleSnapshot}: ${commerceErrorMessage(e)}`);
      }
    }
    setBusy(false);
    const added = lines.length - failed.length;
    if (failed.length) toast.error(added ? `${added} of ${lines.length} items added. ${failed.join(" · ")}` : `Couldn't add these items. ${failed.join(" · ")}`);
    else toast.success(`${added} item${added === 1 ? "" : "s"} added to your cart at today's prices.`);
    if (added) navigate("/cart");
  };

  return (
    <Button variant="secondary" size="sm" className="rounded-full" loading={busy} onClick={() => void run()}>
      <ArrowsCounterClockwiseIcon /> Buy again
    </Button>
  );
}
