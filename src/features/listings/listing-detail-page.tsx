import * as React from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CaretRightIcon, InfoIcon, MapPinIcon, PackageIcon, SealCheckIcon, StorefrontIcon } from "@phosphor-icons/react";
import { ListingImage } from "@/components/common/listing-image";
import { ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { listingsService } from "@/services/listings.service";
import { isApiError } from "@/lib/api/errors";
import { formatDate, formatMoney, formatNumber, humanize } from "@/lib/utils/format";
import { searchHref } from "@/features/search/lib/search-params";
import { ListingRail } from "./components/listing-rail";
import { AddToCart } from "@/features/cart/add-to-cart";

function Gallery({ images, title }: { images: Array<{ fileAssetId: string; cdnUrl: string }>; title: string }) {
  const [index, setIndex] = React.useState(0);
  const current = images[index];
  return (
    <div>
      <ListingImage src={current?.cdnUrl} alt={title} className="aspect-[4/3] w-full rounded-xl" />
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Images">
          {images.map((img, i) => (
            <button
              key={img.fileAssetId}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`shrink-0 cursor-pointer overflow-hidden rounded-md border-2 ${i === index ? "border-foreground" : "border-transparent"}`}
            >
              <ListingImage src={img.cdnUrl} alt="" className="size-16" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListingDetailPage() {
  const { listingId = "" } = useParams();
  const q = useQuery({
    queryKey: ["listing", "public", listingId],
    queryFn: ({ signal }) => listingsService.publicDetail(listingId, signal),
    retry: (count, error) => !(isApiError(error) && [404, 410].includes(error.status)) && count < 1,
  });

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
  const images = l.galleryImages.length ? [...l.galleryImages].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder) : l.primaryImage ? [l.primaryImage] : [];
  const place = [l.location.city, l.location.stateOrEmirate].filter(Boolean).join(", ");
  const unit = l.quantityUnitSymbol ?? l.unitOfMeasure ?? "";
  const specs = [
    ["Category", l.categoryName],
    ["Brand", l.brandName],
    ["Condition", l.conditionName],
    ["Grade", l.gradeName],
    ["Pricing", humanize(l.pricingMode)],
    ["Listing no.", l.listingNumber],
    ["Listed", formatDate(l.publishedAtUtc)],
    ["Available until", l.expiresAtUtc ? formatDate(l.expiresAtUtc) : null],
  ].filter((r): r is [string, string] => !!r[1]);

  return (
    <>
      <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6">
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

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
          <Gallery images={images} title={l.title} />

          <div>
            <div className="flex flex-wrap gap-2">
              {l.seller.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-foreground">
                  Verified seller <SealCheckIcon className="size-3.5" weight="fill" />
                </span>
              )}
              {l.conditionName && <span className="rounded-sm bg-surface-muted px-2 py-0.5 text-xs text-foreground">{l.conditionName}</span>}
            </div>
            <h1 className="mt-3 font-heading text-[28px] font-bold leading-9 text-foreground sm:text-[32px] sm:leading-10">{l.title}</h1>
            <p className="mt-4 font-heading text-3xl font-bold text-foreground">
              {formatMoney(l.basePrice, l.currency)}
              {unit && <span className="ml-1 font-sans text-base font-normal text-muted-foreground">per {unit}</span>}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-surface-muted p-3">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PackageIcon className="size-4" /> Available
                </dt>
                <dd className="mt-1 font-medium text-foreground">{l.isAvailable ? `${formatNumber(l.sellableQuantity)} ${unit}` : "Out of stock"}</dd>
              </div>
              <div className="rounded-lg bg-surface-muted p-3">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPinIcon className="size-4" /> Location
                </dt>
                <dd className="mt-1 font-medium text-foreground">{place || "—"}</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-cream">
                  <StorefrontIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{l.seller.displayName}</p>
                  <p className="text-xs text-muted-foreground">{humanize(l.seller.entityType)} seller{l.seller.isVerified ? " · KYC verified" : ""}</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <AddToCart
                listing={{
                  listingId: l.listingId,
                  title: l.title,
                  sellerName: l.seller.displayName,
                  basePrice: l.basePrice,
                  currency: l.currency,
                  unitSymbol: unit || null,
                  imageUrl: images[0]?.cdnUrl ?? null,
                  sellableQuantity: l.sellableQuantity,
                  isAvailable: l.isAvailable,
                }}
              />
            </div>

            {specs.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 font-heading text-lg font-bold text-foreground">Details</h2>
                <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="text-right text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </div>

        {(l.description || l.attributes.length > 0) && (
          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
            {l.description && (
              <section>
                <h2 className="mb-3 font-heading text-xl font-bold text-foreground">Description</h2>
                <p className="whitespace-pre-line text-sm leading-6 text-body">{l.description}</p>
              </section>
            )}
            {l.attributes.length > 0 && (
              <section>
                <h2 className="mb-3 font-heading text-xl font-bold text-foreground">Specifications</h2>
                <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                  {l.attributes.map((a) => (
                    <div key={a.code} className="flex justify-between gap-4 px-4 py-2.5">
                      <dt className="text-muted-foreground">{a.name}</dt>
                      <dd className="text-right text-foreground">{a.textValue ?? (a.numValue !== null ? formatNumber(a.numValue) : "—")}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
      </div>
      <ListingRail title={`More in ${l.categoryName}`} query={{ categoryId: l.categoryId, sort: "date_desc" }} viewAllHref={searchHref({ categoryId: l.categoryId })} />
    </>
  );
}
