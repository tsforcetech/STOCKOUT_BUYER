import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import { buyerCommerceService as svc } from "@/services/buyer-commerce.service";
import { useAuth } from "@/lib/auth/auth-context";
import { commerceCode, commerceErrorMessage } from "./commerce-errors";

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

type CartOp =
  | { kind: "quantity"; listingId: string; quantity: number }
  | { kind: "remove"; listingId: string }
  | { kind: "clear" }
  | { kind: "save"; listingId: string }
  | { kind: "restore"; listingId: string }
  | { kind: "removeSaved"; listingId: string };

/**
 * Cart-page mutations. Each sends the cart's current rowVersion as If-Match; on CART_CONCURRENCY_CONFLICT the cart
 * is re-read and the buyer decides again (no automatic retry, per the handoff).
 */
export function useCartActions() {
  const qc = useQueryClient();
  const rv = () => qc.getQueryData<BuyerCartResponse>(commerceKeys.cart)?.rowVersion ?? null;
  return useMutation({
    mutationFn: (op: CartOp) => {
      switch (op.kind) {
        case "quantity":
          return svc.updateQuantity(op.listingId, op.quantity, rv());
        case "remove":
          return svc.removeItem(op.listingId, rv());
        case "clear":
          return svc.clear(rv());
        case "save":
          return svc.saveForLater(op.listingId, rv());
        case "restore":
          return svc.savedToCart(op.listingId, rv());
        case "removeSaved":
          return svc.removeSaved(op.listingId, rv());
      }
    },
    onSuccess: (cart, op) => {
      qc.setQueryData(commerceKeys.cart, cart);
      if (op.kind === "save" || op.kind === "restore" || op.kind === "removeSaved") void qc.invalidateQueries({ queryKey: commerceKeys.saved });
    },
    onError: (e) => {
      toast.error(commerceErrorMessage(e));
      if (commerceCode(e) === "CART_CONCURRENCY_CONFLICT" || commerceCode(e) === "COMMERCE_LISTING_NOT_AVAILABLE") {
        void qc.invalidateQueries({ queryKey: commerceKeys.cart });
        void qc.invalidateQueries({ queryKey: commerceKeys.saved });
      }
    },
  });
}
