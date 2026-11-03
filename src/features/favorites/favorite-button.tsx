import * as React from "react";
import { HeartIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useFavorites, type ListingSnapshot } from "@/lib/favorites/favorites-context";
import { useAuthDialog } from "@/features/auth/auth-dialog";
import { cn } from "@/lib/utils/cn";

/** ♥ wishlist toggle. Signed-out shoppers are asked to sign in; the save completes afterwards. */
export function FavoriteButton({ listing, variant = "overlay", className }: { listing: ListingSnapshot; variant?: "overlay" | "outline"; className?: string }) {
  const { isFavorite, toggle, queue } = useFavorites();
  const { requireAuth } = useAuthDialog();
  const [busy, setBusy] = React.useState(false);
  const on = isFavorite(listing.listingId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-busy={busy || undefined}
      aria-label={on ? `Remove ${listing.title} from your wishlist` : `Save ${listing.title} to your wishlist`}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        const r = await toggle(listing);
        setBusy(false);
        if (r === "auth") requireAuth(() => queue(listing), "Sign in to save listings to your wishlist.");
        else if (r === "added") toast.success("Saved to your wishlist");
        else if (r === "removed") toast.success("Removed from your wishlist");
      }}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-70",
        variant === "overlay" ? "size-9 bg-white/90 text-[#1a1a1a] shadow-raised backdrop-blur hover:bg-white" : "size-11 border border-border-strong bg-surface text-foreground hover:border-foreground",
        className,
      )}
    >
      <HeartIcon className={cn("size-5", on && "text-[#e0245e]")} weight={on ? "fill" : "regular"} />
    </button>
  );
}
