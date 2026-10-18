import * as React from "react";

/**
 * Saved listings (♥) and recently viewed listings. The backend has no favourites API, so both live in
 * this browser's localStorage; each entry keeps a small snapshot so lists render without extra calls.
 */
export interface ListingSnapshot {
  listingId: string;
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
  favorites: ListingSnapshot[];
  isFavorite: (listingId: string) => boolean;
  toggle: (listing: ListingSnapshot) => boolean;
  remove: (listingId: string) => void;
  recent: ListingSnapshot[];
  recordView: (listing: ListingSnapshot) => void;
  clearRecent: () => void;
}

const FAV_KEY = "stockout.market.favorites";
const RECENT_KEY = "stockout.market.recent";
const RECENT_MAX = 12;
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

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = React.useState(() => read(FAV_KEY));
  const [recent, setRecent] = React.useState(() => read(RECENT_KEY));

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAV_KEY) setFavorites(read(FAV_KEY));
      if (e.key === RECENT_KEY) setRecent(read(RECENT_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = React.useMemo<FavoritesContextValue>(() => {
    const ids = new Set(favorites.map((f) => f.listingId));
    return {
      favorites,
      isFavorite: (id) => ids.has(id),
      toggle: (listing) => {
        const adding = !ids.has(listing.listingId);
        setFavorites((prev) => {
          const next = adding ? [{ ...listing, savedAtUtc: new Date().toISOString() }, ...prev.filter((f) => f.listingId !== listing.listingId)] : prev.filter((f) => f.listingId !== listing.listingId);
          write(FAV_KEY, next);
          return next;
        });
        return adding;
      },
      remove: (id) =>
        setFavorites((prev) => {
          const next = prev.filter((f) => f.listingId !== id);
          write(FAV_KEY, next);
          return next;
        }),
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
  }, [favorites, recent]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
