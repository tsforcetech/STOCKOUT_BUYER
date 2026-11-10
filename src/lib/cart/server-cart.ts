import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import { buyerCommerceService as svc } from "@/services/buyer-commerce.service";
import { useAuth } from "@/lib/auth/auth-context";
import { commerceCode, commerceErrorMessage, reportIfMatchError } from "./commerce-errors";

export const commerceKeys = {
  cart: ["buyer", "cart"] as const,
  saved: ["buyer", "cart", "saved-items"] as const,
  wishlist: ["buyer", "wishlist"] as const,
  wishlistPage: (page: number, pageSize: number) => ["buyer", "wishlist", "page", page, pageSize] as const,
  wishlistIds: ["buyer", "wishlist", "ids"] as const,
};

/** The signed-in buyer's server cart (Stage 8A.2). Not fetched for guests. */
export function useServerCart() {
  const { status } = useAuth();
  return useQuery({ queryKey: commerceKeys.cart, queryFn: ({ signal }) => svc.cart(signal), enabled: status === "authenticated", staleTime: 30_000 });
}

export function useSavedItems(enabled = true) {
  const { status } = useAuth();
  return useQuery({ queryKey: commerceKeys.saved, queryFn: ({ signal }) => svc.savedItems(signal), enabled: enabled && status === "authenticated", staleTime: 30_000 });
}

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Runs cart writes one at a time, each with the rowVersion of the cart as it stands when the write starts (not when
 * it was queued), and stores the returned cart before the next write starts. BUYER_CART.RowVersion is the single
 * concurrency token, so two overlapping writes would otherwise both send the same token and the second would 409.
 * Exported for the add-to-cart path in cart-context, which is not a cart-page mutation.
 */
export function cartWrite(qc: QueryClient, write: (rowVersion: string | null) => Promise<BuyerCartResponse>): Promise<BuyerCartResponse> {
  const run = writeChain.then(async () => {
    const cart = await write(qc.getQueryData<BuyerCartResponse>(commerceKeys.cart)?.rowVersion || null);
    qc.setQueryData(commerceKeys.cart, cart);
    return cart;
  });
  writeChain = run.catch(() => undefined);
  return run;
}

type CartOp =
  | { kind: "quantity"; listingId: string; quantity: number }
  | { kind: "remove"; listingId: string }
  | { kind: "clear" }
  | { kind: "save"; listingId: string }
  | { kind: "restore"; listingId: string }
  | { kind: "removeSaved"; listingId: string };

/**
 * Cart-page mutations. Each sends the cart's current rowVersion as If-Match; on CART_CONCURRENCY_CONFLICT the cart
 * is re-read and the buyer decides again (never retried automatically with the new token, per handoff v1.2).
 */
export function useCartActions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (op: CartOp) =>
      cartWrite(qc, (rv) => {
        switch (op.kind) {
          case "quantity":
            return svc.updateQuantity(op.listingId, op.quantity, rv);
          case "remove":
            return svc.removeItem(op.listingId, rv);
          case "clear":
            return svc.clear(rv);
          case "save":
            return svc.saveForLater(op.listingId, rv);
          case "restore":
            return svc.savedToCart(op.listingId, rv);
          case "removeSaved":
            return svc.removeSaved(op.listingId, rv);
        }
      }),
    // Remove / save-for-later take the line out of the cart on screen at once (no wait for the server); the server
    // answer replaces it, and a failure puts the previous cart back. Totals stay the server's until it answers.
    onMutate: async (op) => {
      if (op.kind !== "remove" && op.kind !== "save") return undefined;
      await qc.cancelQueries({ queryKey: commerceKeys.cart });
      const before = qc.getQueryData<BuyerCartResponse>(commerceKeys.cart);
      if (before) qc.setQueryData(commerceKeys.cart, withoutLine(before, op.listingId));
      return { before };
    },
    onSuccess: (_cart, op) => {
      if (op.kind === "save" || op.kind === "restore" || op.kind === "removeSaved") void qc.invalidateQueries({ queryKey: commerceKeys.saved });
    },
    onError: (e, _op, ctx) => {
      if (ctx?.before) qc.setQueryData(commerceKeys.cart, ctx.before);
      toast.error(commerceErrorMessage(e));
      reportIfMatchError(e);
      if (commerceCode(e) === "CART_CONCURRENCY_CONFLICT" || commerceCode(e) === "COMMERCE_LISTING_NOT_AVAILABLE") {
        void qc.invalidateQueries({ queryKey: commerceKeys.cart });
        void qc.invalidateQueries({ queryKey: commerceKeys.saved });
      }
    },
  });
}

/** The cart without one line (and without a seller group it empties). rowVersion is kept: it is the server's. */
export function withoutLine(cart: BuyerCartResponse, listingId: string): BuyerCartResponse {
  const id = listingId.toLowerCase();
  const sellerGroups = cart.sellerGroups.map((g) => ({ ...g, items: g.items.filter((i) => i.listingId.toLowerCase() !== id) })).filter((g) => g.items.length > 0);
  const removed = cart.sellerGroups.reduce((n, g) => n + g.items.filter((i) => i.listingId.toLowerCase() === id).length, 0);
  return { ...cart, sellerGroups, itemCount: Math.max(0, cart.itemCount - removed) };
}
