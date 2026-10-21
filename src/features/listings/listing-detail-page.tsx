import * as React from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CaretRightIcon,
  CurrencyCircleDollarIcon,
  HashIcon,
  HourglassMediumIcon,
  InfoIcon,
  MapPinIcon,
  MedalIcon,
  PackageIcon,
  SealCheckIcon,
  SparkleIcon,
  SquaresFourIcon,
  StorefrontIcon,
  TagIcon,
  type Icon,
} from "@phosphor-icons/react";
import { ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { listingsService } from "@/services/listings.service";
import { isApiError } from "@/lib/api/errors";
import { formatDate, formatMoney, formatNumber, humanize } from "@/lib/utils/format";
import { searchHref } from "@/features/search/lib/search-params";
import { useFavorites, type ListingSnapshot } from "@/lib/favorites/favorites-context";
import { FavoriteButton } from "@/features/favorites/favorite-button";
import { AddToCart, type AddToCartListing } from "@/features/cart/add-to-cart";
import { RfqBanner } from "@/features/rfq/rfq-banner";
import type { PublicListingDetailResponse } from "@/api/types/seller-listings";
import { ListingRail } from "./components/listing-rail";
import { isSameItem, sameItemQuery } from "./lib/same-item";
import type { ListingSearchCard } from "@/api/types/search";
import { ListingGallery } from "./components/listing-gallery";
import { ListingShareButton } from "./components/listing-share-button";
import { ListingSafetyTips } from "./components/listing-safety-tips";
import { ListingMobileBar } from "./components/listing-mobile-bar";
import { VerifiedTag } from "./components/verified-tag";
import { attributeDisplayValue } from "./lib/attribute-value";

function sortedImages(l: PublicListingDetailResponse) {
  if (l.galleryImages.length) return [...l.galleryImages].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder);
  return l.primaryImage ? [l.primaryImage] : [];
}

function placeOf(l: PublicListingDetailResponse) {
  return [l.location.city, l.location.stateOrEmirate].filter(Boolean).join(", ");
}

function unitOf(l: PublicListingDetailResponse) {
  return l.quantityUnitSymbol ?? l.unitOfMeasure ?? "";
}

function snapshotOf(l: PublicListingDetailResponse): ListingSnapshot {
  return {
    listingId: l.listingId,
    title: l.title,
    price: l.basePrice,
    currency: l.currency,
    unitSymbol: unitOf(l) || null,
    imageUrl: sortedImages(l)[0]?.cdnUrl ?? null,
    sellerName: l.seller.displayName,
    place: placeOf(l) || null,
  };
}

type Spec = { label: string; value: string; icon?: Icon };

function DefinitionGrid({ items }: { items: Spec[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {items.map(({ label, value, icon: ItemIcon }) => (
        <div key={label} className="flex min-w-0 items-start gap-3 border-b border-border py-3">
          {ItemIcon && (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-cream-strong text-foreground">
              <ItemIcon className="size-4" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export default function ListingDetailPage() {
  const { listingId = "" } = useParams();
  const q = useQuery({
    queryKey: ["listing", "public", listingId],
    queryFn: ({ signal }) => listingsService.publicDetail(listingId, signal),
    retry: (count, error) => !(isApiError(error) && [404, 410].includes(error.status)) && count < 1,
  });
  const { recordView } = useFavorites();
  const recordedFor = React.useRef<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const data = q.data;
  const snapshot = React.useMemo(() => (data ? snapshotOf(data) : null), [data]);

  // Recently viewed: record once per listing after a successful load.
  React.useEffect(() => {
    if (!snapshot || recordedFor.current === snapshot.listingId) return;
    recordedFor.current = snapshot.listingId;
    recordView(snapshot);
  }, [snapshot, recordView]);

  if (q.isLoading) {
    return (
      <div className="mx-auto grid max-w-[1336px] grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (q.error) {
    const unavailable = isApiError(q.error) && q.error.status === 410;
    return (
      <div className="mx-auto max-w-[760px] px-4 py-16 sm:px-6">
        {unavailable ? (
          <div className="rounded-xl bg-cream p-8 text-center">
            <InfoIcon className="mx-auto size-10 text-foreground" />
            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">This listing isn't available right now</h1>
            <p className="mt-2 text-sm text-body">It may be paused by the seller, suspended or expired.</p>
            <Link to="/search" className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm text-primary-foreground">
              Browse other stock
            </Link>
          </div>
        ) : (
          <ErrorState error={q.error} onRetry={() => q.refetch()} title={isApiError(q.error) && q.error.status === 404 ? "Listing not found" : undefined} />
        )}
      </div>
    );
  }

  const l = q.data!;
  const images = sortedImages(l);
  const place = placeOf(l);
  const unit = unitOf(l);
  // BASE_URL keeps the deploy sub-path (e.g. /STOCKOUT_BUYER/) so shared links resolve.
  const url = new URL(`${import.meta.env.BASE_URL}listings/${encodeURIComponent(l.listingId)}`, window.location.origin).toString();
  // Same product from other sellers, for buyers who need more than this seller has. Ordered by stock, not price.
  const otherSellers = (items: ListingSearchCard[]) =>
    items
      .filter((x) => x.listingId !== l.listingId && x.seller.sellerId !== l.seller.sellerId && x.isAvailable && x.sellableQuantity > 0 && isSameItem(l.title, x.title))
      .sort((a, b) => b.sellableQuantity - a.sellableQuantity);
  const cartListing: AddToCartListing = {
    listingId: l.listingId,
    title: l.title,
    sellerName: l.seller.displayName,
    basePrice: l.basePrice,
    currency: l.currency,
    unitSymbol: unit || null,
    imageUrl: images[0]?.cdnUrl ?? null,
    sellableQuantity: l.sellableQuantity,
    isAvailable: l.isAvailable,
  };
  const specs = (
    [
      { label: "Category", value: l.categoryName, icon: SquaresFourIcon },
      { label: "Brand", value: l.brandName, icon: TagIcon },
      { label: "Condition", value: l.conditionName, icon: SparkleIcon },
      { label: "Grade", value: l.gradeName, icon: MedalIcon },
      { label: "Pricing", value: humanize(l.pricingMode), icon: CurrencyCircleDollarIcon },
      { label: "Listing no.", value: l.listingNumber, icon: HashIcon },
      { label: "Listed", value: formatDate(l.publishedAtUtc), icon: CalendarBlankIcon },
      { label: "Available until", value: l.expiresAtUtc ? formatDate(l.expiresAtUtc) : null, icon: HourglassMediumIcon },
    ] as Array<{ label: string; value: string | null; icon: Icon }>
  ).filter((s): s is { label: string; value: string; icon: Icon } => !!s.value);
  const attributes: Spec[] = l.attributes.map((a) => ({
    label: a.name,
    value: attributeDisplayValue(a) ?? "—",
  }));

  return (
    <>
      <div className="mx-auto max-w-[1336px] px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <li>
              <Link to="/search" className="hover:text-foreground">
                Marketplace
              </Link>
            </li>
            {l.categoryBreadcrumb.map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-1">
                <CaretRightIcon className="size-3" />
                {l.categoryPathIds[i] ? (
                  <Link to={searchHref({ categoryId: l.categoryPathIds[i] })} className="hover:text-foreground">
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <ListingGallery key={l.listingId} images={images} title={l.title} />
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="lg:sticky lg:top-[176px]">
            <div className="flex flex-wrap gap-2">
              <VerifiedTag size="md" />
              {l.conditionName && <span className="rounded-sm bg-surface-muted px-2 py-0.5 text-xs text-foreground">{l.conditionName}</span>}
              {!l.isAvailable && <span className="rounded-sm bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-soft-foreground">Out of stock</span>}
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              <h1 className="min-w-0 break-words font-heading text-[26px] font-bold leading-8 text-foreground sm:text-[32px] sm:leading-10">{l.title}</h1>
              <div className="flex shrink-0 gap-2">
                {snapshot && <FavoriteButton listing={snapshot} variant="outline" />}
                <ListingShareButton title={l.title} url={url} />
              </div>
            </div>

            <p className="mt-3 font-heading text-3xl font-bold text-foreground">
              {formatMoney(l.basePrice, l.currency)}
              {unit && <span className="ml-1 font-sans text-base font-normal text-muted-foreground">per {unit}</span>}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="min-w-0 rounded-xl bg-cream-strong p-3">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PackageIcon className="size-4" /> Available
                </dt>
                <dd className="mt-1 truncate font-medium text-foreground">{l.isAvailable ? `${formatNumber(l.sellableQuantity)} ${unit}` : "Out of stock"}</dd>
              </div>
              <div className="min-w-0 rounded-xl bg-cream-strong p-3">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPinIcon className="size-4" /> Location
                </dt>
                <dd className="mt-1 break-words font-medium leading-5 text-foreground">{place || "—"}</dd>
              </div>
            </dl>

            <div ref={panelRef} className="mt-5 scroll-mt-28">
              <AddToCart listing={cartListing} />
            </div>

            <RfqBanner
              variant="compact"
              className="mt-3"
              options={{
                source: "listing",
                prefill: { item: l.title, categoryId: l.categoryId, unit },
                context: l.isAvailable ? `Need more than ${formatNumber(l.sellableQuantity)} ${unit}, or a different size, brand or grade?` : "This one is out of stock. Tell us what you need and sellers will quote you.",
              }}
              title={l.isAvailable ? "Need more, or a different spec?" : "Out of stock? Request a quote"}
              body="Send a request for quote. Verified sellers with matching stock reply."
            />

            <section aria-label="Seller" className="mt-5 rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-cream-strong text-foreground">
                  <StorefrontIcon className="size-6" />
                  {l.seller.isVerified && (
                    <SealCheckIcon className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-surface text-success" weight="fill" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                    <span className="truncate">{l.seller.displayName}</span>
                    {l.seller.isVerified && <SealCheckIcon className="size-4 shrink-0 text-success" weight="fill" aria-label="Verified" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {humanize(l.seller.entityType)} seller
                    {l.seller.isVerified ? " · KYC verified" : ""}
                  </p>
                </div>
              </div>
              <Link
                to={searchHref({ sellerId: l.seller.sellerId })}
                className="mt-4 flex h-10 items-center justify-center gap-1.5 rounded-lg border border-secondary-border text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                View all stock from this seller <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </section>

            <ListingSafetyTips className="mt-5" />
            </div>
          </div>

          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
            {specs.length > 0 && (
              <section>
                <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Details</h2>
                <DefinitionGrid items={specs} />
              </section>
            )}
            {l.description && (
              <section>
                <h2 className="mb-3 font-heading text-xl font-bold text-foreground">Description</h2>
                <p className="whitespace-pre-line break-words text-sm leading-6 text-body">{l.description}</p>
              </section>
            )}
            {attributes.length > 0 && (
              <section>
                <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Specifications</h2>
                <DefinitionGrid items={attributes} />
              </section>
            )}
          </div>
        </div>
      </div>
      <div ref={endRef} aria-hidden />
      <ListingRail
        title="Need more stock? Also available from other sellers"
        subtitle="The same item from other verified sellers, with the most stock first."
        query={{ q: sameItemQuery(l.title), categoryId: l.categoryId }}
        select={otherSellers}
        viewAllHref={searchHref({ q: sameItemQuery(l.title), categoryId: l.categoryId })}
      />
      <ListingRail title={`More from ${l.seller.displayName}`} query={{ sellerId: l.seller.sellerId, sort: "date_desc" }} viewAllHref={searchHref({ sellerId: l.seller.sellerId })} />
      <ListingRail title={`More in ${l.categoryName}`} query={{ categoryId: l.categoryId, sort: "date_desc" }} viewAllHref={searchHref({ categoryId: l.categoryId })} />
      <ListingMobileBar listing={cartListing} panelRef={panelRef} endRef={endRef} />
    </>
  );
}
