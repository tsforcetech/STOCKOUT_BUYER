import * as React from "react";

/**
 * Buyer cart. The backend has no cart/order/checkout API yet (bidding-deal and subscription-payment
 * expose only /system/version), so the cart lives in this browser's localStorage. It stores a snapshot
 * of each listing at the time it was added; the cart page re-reads live price and stock from the
 * public listing API before showing totals.
 */
export interface CartItem {
  listingId: string;
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

interface CartContextValue {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, "addedAtUtc">) => void;
  setQuantity: (listingId: string, quantity: number) => void;
  remove: (listingId: string) => void;
  clear: () => void;
  has: (listingId: string) => boolean;
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

export function clampQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  const capped = max > 0 ? Math.min(quantity, max) : quantity;
  return Math.round(capped * 1000) / 1000;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>(read);

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

  const value = React.useMemo<CartContextValue>(
    () => ({
      items,
      count: items.length,
      add: (item) =>
        update((prev) => {
          const existing = prev.find((i) => i.listingId === item.listingId);
          if (existing) {
            return prev.map((i) => (i.listingId === item.listingId ? { ...i, ...item, quantity: clampQuantity(i.quantity + item.quantity, item.maxQuantity) } : i));
          }
          return [...prev, { ...item, quantity: clampQuantity(item.quantity, item.maxQuantity), addedAtUtc: new Date().toISOString() }];
        }),
      setQuantity: (listingId, quantity) => update((prev) => prev.map((i) => (i.listingId === listingId ? { ...i, quantity: clampQuantity(quantity, i.maxQuantity) } : i))),
      remove: (listingId) => update((prev) => prev.filter((i) => i.listingId !== listingId)),
      clear: () => update(() => []),
      has: (listingId) => items.some((i) => i.listingId === listingId),
    }),
    [items, update],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
