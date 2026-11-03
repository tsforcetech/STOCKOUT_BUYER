import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import { buyerCommerceService } from "@/services/buyer-commerce.service";
import { useAuth } from "@/lib/auth/auth-context";
import { commerceKeys, useServerCart } from "./server-cart";
import { wholeQuantity } from "./guest-merge";

/**
 * Buyer cart (Stage 8A.2).
 * - Signed out: a guest cart in this browser's localStorage (snapshots; the cart page re-reads live price/stock).
 * - Signed in: the server cart (GET/POST /api/v1/buyer/cart…). Guest items stay on the device until the buyer
 *   explicitly merges them (see guest-merge.ts and MergePrompt); they are never replayed automatically.
 */
export interface CartItem {
  listingId: string;
  /** Needed for the server merge; older device carts may not have it (looked up at merge time). */
  sellerId?: string;
  title: string;
  sellerName: string;
  unitPrice: number;
  currency: string;
  unitSymbol: string | null;
  imageUrl: string | null;
  quantity: number;
  /** Sellable quantity when added; the cart page re-checks it live. */
  maxQuantity: number;
  addedAtUtc: string;
}

export type AddInput = Omit<CartItem, "addedAtUtc" | "sellerId"> & { sellerId: string };

interface CartContextValue {
  /** "server" once signed in. */
  mode: "guest" | "server";
  /** Lines in the active cart (server itemCount when signed in). */
  count: number;
  /** Device (guest) cart items. When signed in these are the items still waiting to be merged. */
  items: CartItem[];
  setQuantity: (listingId: string, quantity: number) => void;
  remove: (listingId: string) => void;
  clear: () => void;
  /** Is this listing in the active cart? */
  has: (listingId: string) => boolean;
  /** Adds to the active cart. Server errors are thrown so the caller can explain them. */
  add: (item: AddInput) => Promise<void>;
  /** Side drawer (mini cart) state. */
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const KEY = "stockout.market.cart";
const CartContext = React.createContext<CartContextValue | null>(null);

function isCartItem(v: unknown): v is CartItem {
  const i = v as CartItem;
  return !!i && typeof i.listingId === "string" && typeof i.title === "string" && typeof i.quantity === "number" && typeof i.unitPrice === "number";
}

function read(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode): the cart still works for this tab */
  }
}

/** Whole units (the server cart is integer-only); capped at the known stock when adding on the device. */
export function clampQuantity(quantity: number, max: number): number {
  const q = wholeQuantity(quantity);
  return max > 0 ? Math.max(1, Math.min(q, Math.floor(max) || 1)) : q;
}

export const cartListingIds = (cart: BuyerCartResponse | undefined) => new Set((cart?.sellerGroups ?? []).flatMap((g) => g.items.map((i) => i.listingId.toLowerCase())));

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const qc = useQueryClient();
  const server = useServerCart();
  const [items, setItems] = React.useState<CartItem[]>(read);
  const [isOpen, setOpen] = React.useState(false);
  const mode = status === "authenticated" ? "server" : "guest";

  // Keep tabs in sync.
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = React.useCallback((fn: (prev: CartItem[]) => CartItem[]) => {
    setItems((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  const serverIds = React.useMemo(() => cartListingIds(server.data), [server.data]);

  const value = React.useMemo<CartContextValue>(
    () => ({
      mode,
      count: mode === "server" ? (server.data?.itemCount ?? 0) : items.length,
      items,
      add: async (item) => {
        if (mode === "server") {
          const cart = await buyerCommerceService.addItem({ listingId: item.listingId, sellerId: item.sellerId, quantity: wholeQuantity(item.quantity) });
          qc.setQueryData(commerceKeys.cart, cart);
          return;
        }
        update((prev) => {
          const existing = prev.find((i) => i.listingId === item.listingId);
          if (existing) {
            return prev.map((i) => (i.listingId === item.listingId ? { ...i, ...item, quantity: clampQuantity(i.quantity + item.quantity, item.maxQuantity) } : i));
          }
          return [...prev, { ...item, quantity: clampQuantity(item.quantity, item.maxQuantity), addedAtUtc: new Date().toISOString() }];
        });
      },
      setQuantity: (listingId, quantity) => update((prev) => prev.map((i) => (i.listingId === listingId ? { ...i, quantity: clampQuantity(quantity, i.maxQuantity) } : i))),
      remove: (listingId) => update((prev) => prev.filter((i) => i.listingId !== listingId)),
      clear: () => update(() => []),
      has: (listingId) => (mode === "server" ? serverIds.has(listingId.toLowerCase()) : items.some((i) => i.listingId === listingId)),
      isOpen,
      setOpen,
    }),
    [mode, server.data, items, update, isOpen, serverIds, qc],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
