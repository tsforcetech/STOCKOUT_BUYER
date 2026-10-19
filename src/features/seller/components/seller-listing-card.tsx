import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArchiveIcon,
  MapPinIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { ListingImage } from "@/components/common/listing-image";
import { StatusBadge } from "@/components/common/status-badge";
import { RowAction } from "@/components/common/section-card";
import { sellerListingsService } from "@/services/seller-listings.service";
import { filesService } from "@/services/files.service";
import {
  getSellerListingActions,
  type SellerListingListItemResponse,
} from "@/api/types/seller-listings";
import { formatMoney, formatNumber, timeAgo } from "@/lib/utils/format";
import { LISTING_STATUS_LABELS } from "../lib/listing";
import { sellerKeys } from "../lib/queries";

type LifecycleAction = "submit" | "pause" | "resume" | "archive";

/**
 * Grid card for the seller's own listings (same look as the buyer cards). The list endpoint returns only
 * title / status / category / dates, so each card loads its version (price, location), stock and primary
 * photo lazily; those queries share cache keys with the listing editor.
 */
export function SellerListingCard({
  sellerId,
  item,
  categoryName,
  onAction,
}: {
  sellerId: string;
  item: SellerListingListItemResponse;
  categoryName?: string;
  onAction: (
    action: LifecycleAction,
    target: { listingId: string; title: string },
  ) => void;
}) {
  const id = item.listingId;
  const detail = useQuery({
    queryKey: sellerKeys.detail(sellerId, id),
    queryFn: ({ signal }) => sellerListingsService.detail(sellerId, id, signal),
    staleTime: 60_000,
  });
  // The media endpoint answers 409 for listings without a draft (published/paused), so only ask for drafts.
  const media = useQuery({
    queryKey: sellerKeys.media(sellerId, id),
    queryFn: ({ signal }) => sellerListingsService.media(sellerId, id, signal),
    staleTime: 60_000,
    enabled: !!item.currentDraftVersionId,
    retry: false,
  });
  const inventory = useQuery({
    queryKey: sellerKeys.inventory(sellerId, id),
    queryFn: ({ signal }) =>
      sellerListingsService.inventory(sellerId, id, signal),
    staleTime: 60_000,
    retry: false,
  });
  const primary =
    media.data?.media.find((m) => m.mediaType === "IMAGE" && m.isPrimary) ??
    media.data?.media.find((m) => m.mediaType === "IMAGE");
  const image = useQuery({
    queryKey: ["files", "download-url", primary?.fileAssetId],
    queryFn: () => filesService.downloadUrl(primary!.fileAssetId),
    enabled: !!primary,
    staleTime: 10 * 60_000, // presigned URLs last 15 minutes
    retry: false,
  });

  const version =
    detail.data?.currentDraftVersion ?? detail.data?.publishedVersion ?? null;
  const loc = version?.location;
  const place = loc
    ? [loc.city, loc.stateOrEmirate].filter(Boolean).join(", ")
    : null;
  const stock = inventory.data?.sellableQuantity;
  const can = getSellerListingActions({
    status: item.status,
    currentDraftVersionId: item.currentDraftVersionId,
    expiresAtUtc: detail.data?.expiresAtUtc ?? null,
  });
  const target = { listingId: id, title: item.title };
  const updated = timeAgo(item.updatedAtUtc ?? item.createdAtUtc);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-raised">
      <Link to={`/seller/listings/${id}`} className="relative block">
        <ListingImage
          src={image.data?.downloadUrl ?? null}
          alt={item.title}
          className="aspect-[16/10] w-full"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-surface/95 px-1.5 py-0.5 shadow-raised">
            <StatusBadge
              value={item.status}
              label={LISTING_STATUS_LABELS[item.status]}
            />
          </span>
          {item.status !== "DRAFT" && item.currentDraftVersionId && (
            <span className="rounded-md bg-black/70 px-2 py-0.5 text-[11px] text-white">
              + draft
            </span>
          )}
        </div>
        {(media.data?.media.length ?? 0) > 1 && (
          <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] text-white">
            {media.data!.media.length} photos
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {categoryName ?? "—"}
        </p>
        <Link
          to={`/seller/listings/${id}`}
          className="line-clamp-2 font-heading text-base font-bold leading-5 text-foreground hover:underline"
        >
          {item.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <PackageIcon className="size-3.5" />{" "}
            {stock === undefined
              ? inventory.isLoading
                ? "…"
                : "No stock set"
              : `${formatNumber(stock)} in stock`}
          </span>
          {place && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPinIcon className="size-3.5 shrink-0" />{" "}
              <span className="truncate">{place}</span>
            </span>
          )}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-2.5">
          <div>
            <p className="font-heading text-lg font-bold leading-6 text-foreground">
              {version
                ? formatMoney(version.basePrice, version.currency)
                : detail.isLoading
                  ? "…"
                  : "—"}
            </p>
            {updated && (
              <p className="text-[11px] text-muted-foreground">
                Updated {updated}
              </p>
            )}
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Link
              to={`/seller/listings/${id}`}
              aria-label={
                can.canUpdateDraft ? `Edit ${item.title}` : `Open ${item.title}`
              }
              title={can.canUpdateDraft ? "Edit" : "Open"}
              className="flex size-7 items-center justify-center rounded-sm border border-secondary-border bg-surface text-foreground hover:bg-surface-muted"
            >
              <PencilSimpleIcon className="size-4" />
            </Link>
            {can.canSubmit && (
              <RowAction
                label="Submit for review"
                tone="success"
                onClick={() => onAction("submit", target)}
              >
                <PaperPlaneTiltIcon />
              </RowAction>
            )}
            {can.canPause && (
              <RowAction
                label="Pause"
                onClick={() => onAction("pause", target)}
              >
                <PauseIcon />
              </RowAction>
            )}
            {can.canResume && (
              <RowAction
                label="Resume"
                tone="success"
                onClick={() => onAction("resume", target)}
              >
                <PlayIcon />
              </RowAction>
            )}
            {can.canArchive && item.status !== "ARCHIVED" && (
              <RowAction
                label="Archive"
                tone="danger"
                onClick={() => onAction("archive", target)}
              >
                <ArchiveIcon />
              </RowAction>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SellerListingCardSkeleton() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface"
      aria-hidden
    >
      <div className="aspect-[16/10] w-full animate-pulse bg-surface-muted" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-surface-muted" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  );
}
