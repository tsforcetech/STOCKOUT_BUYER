import { Link } from "react-router";
import { MapPinIcon, SealCheckIcon } from "@phosphor-icons/react";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { FavoriteButton } from "@/features/favorites/favorite-button";
import type { ListingSnapshot } from "@/lib/favorites/favorites-context";
import { formatMoney, formatNumber, humanize, timeAgo } from "@/lib/utils/format";
import type { ListingSearchCard, SearchCardAttribute } from "@/api/types/search";

/** Snapshot stored with a ♥ so the saved list renders without refetching the listing. */
export function listingSnapshot(item: ListingSearchCard): ListingSnapshot {
  return {
    listingId: item.listingId,
    title: item.title,
    price: item.basePrice,
    currency: item.currency,
    unitSymbol: item.quantityUnitSymbol,
    imageUrl: assetUrl(item.primaryImage?.cdnUrl),
    sellerName: item.seller.displayName,
    place: item.location.city || item.location.stateOrEmirate || null,
  };
}

function attributeValue(a: SearchCardAttribute): string | null {
  if (a.textValue) return a.textValue;
  if (a.numValue !== null && a.numValue !== undefined) return formatNumber(a.numValue);
  return null;
}

/** Key specs shown as chips: brand / grade from the card, then the first listing attributes that carry a value. */
export function listingSpecs(item: ListingSearchCard, max = 4): string[] {
  const specs: string[] = [];
  if (item.brandName) specs.push(item.brandName);
  if (item.gradeName) specs.push(`Grade ${item.gradeName}`);
  for (const a of item.attributes ?? []) {
    const value = attributeValue(a);
    if (value) specs.push(`${humanize(a.code)}: ${value}`);
  }
  return specs.slice(0, max);
}

/** Horizontal listing row for the search list view: photo left, details middle, price + save right. */
export function ListingRow({ item }: { item: ListingSearchCard }) {
  const place = [item.location.city, item.location.stateOrEmirate].filter(Boolean).join(", ");
  const ago = timeAgo(item.publishedAtUtc);
  const specs = listingSpecs(item);
  const href = `/listings/${item.listingId}`;
  return (
    <article className="group relative flex gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-2.5 transition-shadow hover:shadow-raised sm:gap-5 sm:p-3">
      <div className="relative w-28 shrink-0 self-start overflow-hidden rounded-xl sm:w-52 md:w-60">
        <ListingImage src={item.primaryImage?.cdnUrl} alt={item.title} className="aspect-square w-full sm:aspect-[4/3]" />
        {item.conditionName && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-surface px-1.5 py-0.5 font-heading text-[11px] font-bold text-foreground shadow-raised sm:left-2 sm:top-2 sm:text-xs">{item.conditionName}</span>
        )}
        {!item.isAvailable && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] text-surface">Out of stock</span>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5 sm:flex-row sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span className="truncate">{item.categoryName}</span>
            {place && (
              <>
                <span className="size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                <span className="inline-flex min-w-0 items-center gap-0.5">
                  <MapPinIcon className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{place}</span>
                </span>
              </>
            )}
          </p>
          <h3 className="line-clamp-2 pr-10 font-heading text-[15px] font-bold leading-5 text-foreground sm:pr-0 sm:text-lg sm:leading-6">
            <Link to={href} className="after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none">
              {item.title}
            </Link>
          </h3>
          <p className="flex min-w-0 items-center gap-1 text-xs text-body">
            <span className="truncate">{item.seller.displayName}</span>
            {item.seller.isVerified && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-success" title="Verified seller">
                <SealCheckIcon className="size-4" weight="fill" aria-hidden />
                <span className="sr-only">Verified seller</span>
              </span>
            )}
            {ago && <span className="hidden shrink-0 text-muted-foreground sm:inline">· {ago}</span>}
          </p>
          {specs.length > 0 && (
            <ul className="mt-1 hidden flex-wrap gap-1.5 sm:flex" aria-label="Key specs">
              {specs.map((s) => (
                <li key={s} className="max-w-full truncate rounded-md bg-cream-strong px-2 py-0.5 text-xs text-foreground">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto flex shrink-0 flex-col gap-0.5 sm:mt-0 sm:w-40 sm:items-end sm:justify-between sm:border-l sm:border-border sm:pl-5 sm:text-right">
          <div>
            <p className="font-heading text-base font-bold leading-6 text-foreground sm:text-xl">
              {formatMoney(item.basePrice, item.currency)}
              {item.quantityUnitSymbol && <span className="font-sans text-sm font-normal text-muted-foreground">/{item.quantityUnitSymbol}</span>}
            </p>
            {item.isAvailable && item.sellableQuantity > 0 && (
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                {formatNumber(item.sellableQuantity)} {item.quantityUnitSymbol ?? item.quantityUnitName ?? ""} available
              </p>
            )}
          </div>
        </div>
      </div>

      <FavoriteButton listing={listingSnapshot(item)} variant="outline" className="absolute right-2.5 top-2.5 z-10 size-9 sm:static sm:self-start" />
    </article>
  );
}

export function ListingRowSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-2.5 sm:gap-5 sm:p-3" aria-hidden>
      <div className="aspect-square w-28 shrink-0 animate-pulse rounded-xl bg-surface-muted sm:aspect-[4/3] sm:w-52 md:w-60" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-surface-muted" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  );
}
