import { Link } from "react-router";
import { MapPinIcon, SealCheckIcon } from "@phosphor-icons/react";
import { ListingImage } from "@/components/common/listing-image";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import type { ListingSearchCard } from "@/api/types/search";

/** Figma home "product card": image, verified + condition chips, title, seller, location, price per unit. */
export function ListingCard({ item }: { item: ListingSearchCard }) {
  const place = [item.location.city, item.location.stateOrEmirate].filter(Boolean).join(", ");
  return (
    <Link to={`/listings/${item.listingId}`} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-raised focus-visible:shadow-raised">
      <div className="relative">
        <ListingImage src={item.primaryImage?.cdnUrl} alt={item.title} className="aspect-[4/3] w-full" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {item.seller.isVerified && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success-soft-foreground">
              Verified <SealCheckIcon className="size-3.5" weight="fill" />
            </span>
          )}
          {item.conditionName && <span className="rounded-sm bg-surface/90 px-1.5 py-0.5 text-[11px] text-foreground">{item.conditionName}</span>}
        </div>
        {!item.isAvailable && <span className="absolute bottom-3 left-3 rounded-sm bg-foreground px-1.5 py-0.5 text-[11px] text-surface">Out of stock</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground group-hover:underline">{item.title}</h3>
        <p className="truncate text-xs text-muted-foreground">{item.seller.displayName}</p>
        {place && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0" /> {place}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="text-base font-semibold text-foreground">
            {formatMoney(item.basePrice, item.currency)}
            {item.quantityUnitSymbol && <span className="text-xs font-normal text-muted-foreground">/{item.quantityUnitSymbol}</span>}
          </p>
          {item.isAvailable && item.sellableQuantity > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatNumber(item.sellableQuantity)} {item.quantityUnitSymbol ?? ""} left
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface" aria-hidden>
      <div className="aspect-[4/3] w-full animate-pulse bg-surface-muted" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-4/5 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  );
}
