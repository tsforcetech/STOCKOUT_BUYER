import { HeartIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useFavorites, type ListingSnapshot } from "@/lib/favorites/favorites-context";
import { cn } from "@/lib/utils/cn";

/** ♥ toggle. `variant="overlay"` sits on a card image; `variant="outline"` is a standalone button. */
export function FavoriteButton({ listing, variant = "overlay", className }: { listing: ListingSnapshot; variant?: "overlay" | "outline"; className?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(listing.listingId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${listing.title} from saved` : `Save ${listing.title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(listing);
        toast.success(added ? "Saved to your list" : "Removed from saved");
      }}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full transition-transform active:scale-90",
        variant === "overlay" ? "size-9 bg-white/90 text-[#1a1a1a] shadow-raised backdrop-blur hover:bg-white" : "size-11 border border-border-strong bg-surface text-foreground hover:border-foreground",
        className,
      )}
    >
      <HeartIcon className={cn("size-5", on && "text-[#e0245e]")} weight={on ? "fill" : "regular"} />
    </button>
  );
}
