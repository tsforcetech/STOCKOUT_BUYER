import { safeSellerLabel } from "@/lib/seller-code";
import { Link } from "react-router";
import { ListingImage } from "@/components/common/listing-image";
import type { ListingSnapshot } from "@/lib/favorites/favorites-context";
import { formatMoney } from "@/lib/utils/format";
import { FavoriteButton } from "./favorite-button";

/** Compact card for saved / recently viewed listings (rendered from the stored snapshot). */
export function SnapshotCard({ listing }: { listing: ListingSnapshot }) {
  return (
    <div className="group relative h-full">
      <Link to={`/listings/${listing.listingId}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-raised">
        <ListingImage src={listing.imageUrl} alt={listing.title} className="aspect-[16/10] w-full" />
        <div className="flex flex-1 flex-col gap-1 p-3.5">
          <p className="line-clamp-2 font-heading text-sm font-bold leading-5 text-foreground group-hover:underline">{listing.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {safeSellerLabel(listing.sellerName)}
            {listing.place ? ` · ${listing.place}` : ""}
          </p>
          {listing.price !== null && (
            <p className="mt-auto pt-1 font-heading text-base font-bold text-foreground">
              {formatMoney(listing.price, listing.currency)}
              {listing.unitSymbol && <span className="font-sans text-xs font-normal text-muted-foreground">/{listing.unitSymbol}</span>}
            </p>
          )}
        </div>
      </Link>
      <FavoriteButton className="absolute right-2.5 top-2.5" listing={listing} />
    </div>
  );
}
