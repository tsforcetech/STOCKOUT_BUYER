import { useQueries } from "@tanstack/react-query";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useCart, clampQuantity, type CartItem } from "@/lib/cart/cart-context";
import { listingsService } from "@/services/listings.service";
import { isApiError } from "@/lib/api/errors";
import { toast } from "sonner";
import { useCartActions } from "@/lib/cart/server-cart";
import { commerceErrorMessage } from "@/lib/cart/commerce-errors";
import type { BuyerCartItemResponse } from "@/api/types/buyer-commerce";
import { undoToast } from "./remove-with-undo";

export interface LiveState {
  loading: boolean;
  unavailable: boolean;
  price: number;
  currency: string;
  max: number;
  priceChanged: boolean;
}

/** Re-reads every cart item from the public listing API so totals use the current price and stock. */
export function useLiveItems(items: CartItem[]): Map<string, LiveState> {
  const results = useQueries({
    queries: items.map((i) => ({
      queryKey: ["listing", "public", i.listingId],
      queryFn: ({ signal }: { signal: AbortSignal }) => listingsService.publicDetail(i.listingId, signal),
      staleTime: 60_000,
      retry: (count: number, error: unknown) => !(isApiError(error) && [404, 410].includes(error.status)) && count < 1,
    })),
  });
  return new Map(
    items.map((i, idx) => {
      const r = results[idx];
      const d = r?.data;
      const gone = !!r?.error && isApiError(r.error) && [404, 410].includes(r.error.status);
      return [
        i.listingId,
        {
          loading: !!r?.isLoading,
          unavailable: gone || (!!d && (!d.isAvailable || d.sellableQuantity <= 0)),
          price: d?.basePrice ?? i.unitPrice,
          currency: d?.currency ?? i.currency,
          max: d?.sellableQuantity ?? i.maxQuantity,
          priceChanged: !!d && d.basePrice !== i.unitPrice,
        },
      ];
    }),
  );
}

export function QtyStepper({ item, max }: { item: CartItem; max: number }) {
  const { setQuantity } = useCart();
  return (
    <div className="flex h-9 items-center rounded-full border border-border-strong" role="group" aria-label={`Quantity for ${item.title}`}>
      <button type="button" onClick={() => setQuantity(item.listingId, item.quantity - 1)} disabled={item.quantity <= 1} className="flex size-9 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40" aria-label="Decrease quantity">
        <MinusIcon className="size-3.5" />
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={item.quantity}
        min={1}
        max={max}
        onChange={(e) => setQuantity(item.listingId, clampQuantity(Number(e.target.value), max))}
        aria-label="Quantity"
        className="w-12 bg-transparent text-center text-sm font-medium text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => setQuantity(item.listingId, clampQuantity(item.quantity + 1, max))} disabled={item.quantity >= max} className="flex size-9 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40" aria-label="Increase quantity">
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  );
}


/** Per-currency subtotal of the items that are still available, using live prices and stock. */
export function cartTotals(items: CartItem[], live: Map<string, LiveState>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const i of items) {
    const s = live.get(i.listingId);
    if (!s || s.unavailable) continue;
    totals.set(s.currency, (totals.get(s.currency) ?? 0) + s.price * Math.min(i.quantity, s.max));
  }
  return totals;
}

/**
 * Server-cart remove with a slide-out and an Undo toast. Undo re-adds the listing with the same quantity through the
 * normal add path (so seller rules and If-Match still apply).
 */
export function useServerRemove(mutate: ReturnType<typeof useCartActions>["mutate"], leave: (id: string, run: () => void) => void) {
  const cart = useCart();
  return (item: BuyerCartItemResponse) =>
    leave(item.listingId, () =>
      mutate(
        { kind: "remove", listingId: item.listingId },
        {
          onSuccess: () =>
            undoToast(item.title, () => {
              cart
                .add({
                  listingId: item.listingId,
                  sellerId: item.sellerId,
                  title: item.title,
                  sellerName: "",
                  unitPrice: item.currentPrice,
                  currency: item.currentCurrency,
                  unitSymbol: null,
                  imageUrl: item.thumbnailUrl,
                  quantity: item.quantity,
                  maxQuantity: item.stockAvailable,
                })
                .catch((e: unknown) => toast.error(commerceErrorMessage(e)));
            }),
        },
      ),
    );
}

/** Device-cart remove with a slide-out and an Undo toast. */
export function useGuestRemove(leave: (id: string, run: () => void) => void) {
  const cart = useCart();
  return (item: CartItem) =>
    leave(item.listingId, () => {
      cart.remove(item.listingId);
      undoToast(item.title, () => void cart.add({ ...item, sellerId: item.sellerId ?? "" }));
    });
}
