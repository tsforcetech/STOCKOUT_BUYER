import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { buyerCommerceService as svc } from "@/services/buyer-commerce.service";
import { listingsService } from "@/services/listings.service";
import { commerceKeys } from "@/lib/cart/server-cart";
import { commerceErrorMessage } from "@/lib/cart/commerce-errors";

/**
 * Wishlist (♥) and recently viewed listings.
 * - Signed in: the server wishlist (Stage 8A.2, /api/v1/buyer/wishlist). The ♥ state comes from the buyer's list.
 * - Signed out: ♥ asks the shopper to sign in (no guest wishlist API); the save completes after sign-in.
 * Recently viewed stays in this browser. Hearts saved on this device before Stage 8A.2 can be moved to the account.
 */
export interface ListingSnapshot {
  listingId: string;
  sellerId?: string;
  title: string;
  price: number | null;
  currency: string | null;
  unitSymbol: string | null;
  imageUrl: string | null;
  sellerName: string;
  place: string | null;
  savedAtUtc?: string;
}

interface FavoritesContextValue {
  /** Hearts saved on this device (pre-account). Shown on the wishlist page with a "move to my account" action. */
  favorites: ListingSnapshot[];
  /** Number of wishlist items (server total when signed in). */
  count: number;
  isFavorite: (listingId: string) => boolean;
  /** Adds or removes. For guests it queues the add and returns "auth" so the caller can open sign-in. */
  toggle: (listing: ListingSnapshot) => Promise<"added" | "removed" | "auth" | "error">;
  /** Called once sign-in finishes for a queued guest heart. */
  queue: (listing: ListingSnapshot) => void;
  remove: (listingId: string) => void;
  /** Moves this device's hearts to the signed-in buyer's wishlist. */
  moveDeviceFavorites: () => Promise<number>;
  recent: ListingSnapshot[];
  recordView: (listing: ListingSnapshot) => void;
  clearRecent: () => void;
}

const FAV_KEY = "stockout.market.favorites";
const RECENT_KEY = "stockout.market.recent";
const RECENT_MAX = 12;
const ID_PAGE = 100; // backend max page size
const Ctx = React.createContext<FavoritesContextValue | null>(null);

function read(key: string): ListingSnapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.listingId === "string" && typeof x.title === "string") : [];
  } catch {
    return [];
  }
}
function write(key: string, value: ListingSnapshot[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

async function sellerIdOf(listing: ListingSnapshot): Promise<string> {
  if (listing.sellerId) return listing.sellerId;
  return (await listingsService.publicDetail(listing.listingId)).seller.sellerId;
}

/** All listing ids in the buyer's wishlist (paged at the API maximum). */
async function fetchWishlistIds(signal?: AbortSignal): Promise<{ ids: string[]; total: number }> {
  const ids: string[] = [];
  let total = 0;
  for (let page = 1; page <= 20; page++) {
    const r = await svc.wishlist(page, ID_PAGE, signal);
    total = r.totalItems;
    ids.push(...r.items.map((i) => i.listingId.toLowerCase()));
    if (r.items.length < ID_PAGE || ids.length >= total) break;
  }
  return { ids, total };
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const qc = useQueryClient();
  const signedIn = status === "authenticated";
  const [favorites, setFavorites] = React.useState(() => read(FAV_KEY));
  const [recent, setRecent] = React.useState(() => read(RECENT_KEY));
  const [queued, setQueued] = React.useState<ListingSnapshot | null>(null);
  const server = useQuery({ queryKey: commerceKeys.wishlistIds, queryFn: ({ signal }) => fetchWishlistIds(signal), enabled: signedIn, staleTime: 60_000 });

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAV_KEY) setFavorites(read(FAV_KEY));
      if (e.key === RECENT_KEY) setRecent(read(RECENT_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const serverIds = React.useMemo(() => new Set(server.data?.ids ?? []), [server.data]);
  const refresh = React.useCallback(() => qc.invalidateQueries({ queryKey: commerceKeys.wishlist }), [qc]);

  const addServer = React.useCallback(
    async (listing: ListingSnapshot) => {
      await svc.addToWishlist({ listingId: listing.listingId, sellerId: await sellerIdOf(listing) });
      qc.setQueryData<{ ids: string[]; total: number }>(commerceKeys.wishlistIds, (d) => (d ? { ids: [...d.ids, listing.listingId.toLowerCase()], total: d.total + 1 } : d));
      void refresh();
    },
    [qc, refresh],
  );

  // A heart tapped while signed out is saved as soon as sign-in completes.
  React.useEffect(() => {
    if (!signedIn || !queued) return;
    const l = queued;
    setQueued(null);
    addServer(l).then(
      () => toast.success("Saved to your wishlist"),
      (e) => toast.error(commerceErrorMessage(e)),
    );
  }, [signedIn, queued, addServer]);

  const value = React.useMemo<FavoritesContextValue>(() => {
    const isFavorite = (id: string) => serverIds.has(id.toLowerCase());
    return {
      favorites,
      count: signedIn ? (server.data?.total ?? 0) : 0,
      isFavorite,
      toggle: async (listing) => {
        if (!signedIn) {
          setQueued(listing);
          return "auth";
        }
        try {
          if (isFavorite(listing.listingId)) {
            await svc.removeFromWishlist(listing.listingId);
            qc.setQueryData<{ ids: string[]; total: number }>(commerceKeys.wishlistIds, (d) =>
              d ? { ids: d.ids.filter((x) => x !== listing.listingId.toLowerCase()), total: Math.max(0, d.total - 1) } : d,
            );
            void refresh();
            return "removed";
          }
          await addServer(listing);
          return "added";
        } catch (e) {
          toast.error(commerceErrorMessage(e));
          return "error";
        }
      },
      queue: setQueued,
      remove: (id) =>
        setFavorites((prev) => {
          const next = prev.filter((f) => f.listingId !== id);
          write(FAV_KEY, next);
          return next;
        }),
      moveDeviceFavorites: async () => {
        let moved = 0;
        const left: ListingSnapshot[] = [];
        for (const f of favorites) {
          try {
            if (!serverIds.has(f.listingId.toLowerCase())) await svc.addToWishlist({ listingId: f.listingId, sellerId: await sellerIdOf(f) });
            moved++;
          } catch {
            left.push(f);
          }
        }
        write(FAV_KEY, left);
        setFavorites(left);
        void refresh();
        return moved;
      },
      recent,
      recordView: (listing) =>
        setRecent((prev) => {
          const next = [listing, ...prev.filter((r) => r.listingId !== listing.listingId)].slice(0, RECENT_MAX);
          write(RECENT_KEY, next);
          return next;
        }),
      clearRecent: () => {
        write(RECENT_KEY, []);
        setRecent([]);
      },
    };
  }, [favorites, recent, signedIn, server.data, serverIds, qc, refresh, addServer]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
