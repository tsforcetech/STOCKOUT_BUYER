import { Link } from "react-router";
import { HeartIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/favorites/favorites-context";
import { SnapshotCard } from "./snapshot-card";

export default function SavedPage() {
  const { favorites, recent, clearRecent } = useFavorites();
  return (
    <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
      <h1 className="font-heading text-[28px] font-bold text-foreground sm:text-[32px]">Saved listings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tap ♥ on any listing to keep it here. Saved on this device.</p>

      {favorites.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong p-10 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream">
            <HeartIcon className="size-7 text-foreground" />
          </span>
          <p className="mt-4 font-heading text-lg font-bold text-foreground">Nothing saved yet</p>
          <p className="mt-1 text-sm text-body">Save stock you're interested in to compare and come back later.</p>
          <Button asChild className="mt-5">
            <Link to="/search">Browse marketplace</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map((f) => (
            <li key={f.listingId}>
              <SnapshotCard listing={f} />
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <section className="mt-12" aria-label="Recently viewed">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">Recently viewed</h2>
            <button type="button" onClick={clearRecent} className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Clear history
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
            {recent.map((r) => (
              <li key={r.listingId}>
                <SnapshotCard listing={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
