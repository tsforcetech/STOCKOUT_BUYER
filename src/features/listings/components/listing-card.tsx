import { Link } from "react-router";
import { SealCheckIcon } from "@phosphor-icons/react";
import { ListingImage } from "@/components/common/listing-image";
import { formatMoney, formatNumber, timeAgo } from "@/lib/utils/format";
import type { ListingSearchCard } from "@/api/types/search";

/**
 * Listing card (reference design): large photo with "Stockout verified" + condition chips and a
 * "time ago" chip, uppercase category · location meta line, bold title, seller, price per unit.
 */
export function ListingCard({ item }: { item: ListingSearchCard }) {
  const place = item.location.city || item.location.stateOrEmirate;
  const ago = timeAgo(item.publishedAtUtc);
  return (
    <Link
      to={`/listings/${item.listingId}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-raised focus-visible:shadow-raised"
    >
      <div className="relative">
        <ListingImage src={item.primaryImage?.cdnUrl} alt={item.title} className="aspect-[4/3] w-full" />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {item.seller.isVerified && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-action px-2.5 py-1 font-heading text-[13px] font-bold text-foreground">
              <SealCheckIcon className="size-4" /> Stockout verified
            </span>
          )}
          {item.conditionName && <span className="rounded-lg bg-surface px-2.5 py-1 font-heading text-[13px] font-bold text-foreground shadow-raised">{item.conditionName}</span>}
        </div>
        {ago && <span className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs text-white">{ago}</span>}
        {!item.isAvailable && <span className="absolute bottom-3 left-3 rounded-lg bg-foreground px-2.5 py-1 text-xs text-surface">Out of stock</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <p className="flex items-center gap-2 truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span className="truncate">{item.categoryName}</span>
          {place && (
            <>
              <span className="size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
              <span className="truncate">{place}</span>
            </>
          )}
        </p>
        <h3 className="line-clamp-2 font-heading text-lg font-bold leading-6 text-foreground group-hover:underline">{item.title}</h3>
        <p className="truncate text-sm text-muted-foreground">{item.seller.displayName}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="font-heading text-xl font-bold text-foreground">
            {formatMoney(item.basePrice, item.currency)}
            {item.quantityUnitSymbol && <span className="font-sans text-sm font-normal text-muted-foreground">/{item.quantityUnitSymbol}</span>}
          </p>
          {item.isAvailable && item.sellableQuantity > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatNumber(item.sellableQuantity)} {item.quantityUnitSymbol ?? ""} available
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface" aria-hidden>
      <div className="aspect-[4/3] w-full animate-pulse bg-surface-muted" />
      <div className="space-y-2 p-5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-surface-muted" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  );
}
