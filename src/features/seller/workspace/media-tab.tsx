import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, FileTextIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { RowAction } from "@/components/common/section-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { sellerListingsService } from "@/services/seller-listings.service";
import { listingsService } from "@/services/listings.service";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { getSellerListingActions, LISTING_MEDIA_LIMITS as M, type ListingDetailResponse, type ListingMediaItemResponse, type ListingMediaType } from "@/api/types/seller-listings";
import { FileDownloadAction, OwnImageThumb } from "../components/file-link";
import { Notice } from "../components/notice";
import { isVersionConflict, sellerErrorMessage } from "../lib/errors";
import { patchListingRowVersion, sellerKeys } from "../lib/queries";
import { MediaUploader } from "./media-uploader";

type MediaOp = { kind: "primary"; item: ListingMediaItemResponse } | { kind: "delete"; item: ListingMediaItemResponse } | { kind: "order"; ids: string[] };

export function MediaTab({ sellerId, listing }: { sellerId: string; listing: ListingDetailResponse }) {
  const qc = useQueryClient();
  const id = listing.listingId;
  const can = getSellerListingActions(listing);
  const [toDelete, setToDelete] = React.useState<ListingMediaItemResponse | null>(null);
  const media = useQuery({ queryKey: sellerKeys.media(sellerId, id), queryFn: ({ signal }) => sellerListingsService.media(sellerId, id, signal), enabled: !!listing.currentDraftVersionId });

  const rowVersion = () => qc.getQueryData<ListingDetailResponse>(sellerKeys.detail(sellerId, id))?.rowVersion ?? listing.rowVersion;
  const afterMutation = async (rv: string) => {
    patchListingRowVersion(qc, sellerId, id, rv);
    await qc.invalidateQueries({ queryKey: sellerKeys.media(sellerId, id) });
  };
  const onConflict = async (error: unknown) => {
    if (isVersionConflict(error)) await qc.invalidateQueries({ queryKey: sellerKeys.listing(sellerId, id) });
    throw error;
  };

  const op = useApiMutation({
    toastOnError: false,
    mutationFn: async (o: MediaOp) => {
      try {
        const res =
          o.kind === "primary"
            ? await sellerListingsService.setPrimaryMedia(sellerId, id, o.item.fileAssetId, rowVersion())
            : o.kind === "delete"
              ? await sellerListingsService.deleteMedia(sellerId, id, o.item.fileAssetId, rowVersion())
              : await sellerListingsService.reorderMedia(sellerId, id, rowVersion(), o.ids);
        await afterMutation(res.rowVersion);
      } catch (error) {
        return onConflict(error);
      }
    },
    successMessage: (_d, o) => (o.kind === "primary" ? "Primary photo updated." : o.kind === "delete" ? "Removed from listing." : "Photo order saved."),
    onSuccess: () => setToDelete(null),
  });
  const runOp = (o: MediaOp) => op.mutate(o, { onError: (e) => toast.error(sellerErrorMessage(e)) });

  const attach = async (fileAssetId: string, mediaType: ListingMediaType, documentType: string | null) => {
    try {
      const res = await sellerListingsService.attachMedia(sellerId, id, { expectedRowVersion: rowVersion(), fileAssetId, mediaType, isPrimary: false, documentType });
      await afterMutation(res.rowVersion);
    } catch (error) {
      await onConflict(error);
    }
  };

  if (!listing.currentDraftVersionId) return <PublishedMedia listing={listing} />;
  if (media.isLoading) return <PageSkeleton />;
  if (media.error) return <ErrorState error={media.error} onRetry={() => void media.refetch()} title="Couldn't load media" />;

  const items = media.data?.media ?? [];
  const images = items.filter((m) => m.mediaType === "IMAGE").sort((a, b) => a.displayOrder - b.displayOrder);
  const docs = items.filter((m) => m.mediaType === "DOCUMENT").sort((a, b) => a.displayOrder - b.displayOrder);
  const editable = can.canMutateMedia && !op.isPending;
  const move = (index: number, delta: number) => {
    const ids = images.map((m) => m.fileAssetId);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    runOp({ kind: "order", ids });
  };

  return (
    <div className="space-y-6">
      {!can.canMutateMedia && <Notice>Media is read-only in the listing's current state.</Notice>}
      <Notice title="Known marketplace limitations">
        <ul className="list-disc space-y-1 pl-4">
          <li>A listing needs at least one photo to be submitted, and a primary photo to go live. (A document alone is accepted on submit but won't let it go live.)</li>
          <li>Buyers may not see listing photos yet — the public image link isn't served by the marketplace at the moment.</li>
          <li>Resuming a paused listing re-checks the primary photo and can fail with “not ready” due to a known ownership check issue. Contact support if that happens.</li>
        </ul>
      </Notice>

      {can.canMutateMedia && (
        <MediaUploader disabled={op.isPending} attach={attach} imageSlots={M.DEFAULT_MAX_IMAGES - images.length} documentSlots={M.DEFAULT_MAX_DOCUMENTS - docs.length} />
      )}

      <section aria-labelledby="photos-heading">
        <h3 id="photos-heading" className="mb-3 font-heading text-base font-bold text-foreground">
          Photos <span className="text-sm font-normal text-muted-foreground">({images.length}/{M.DEFAULT_MAX_IMAGES})</span>
        </h3>
        {images.length === 0 ? (
          <EmptyState title="No photos yet" description="Add clear photos of the actual stock. The first photo becomes the primary one." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((m, i) => (
              <li key={m.fileAssetId} className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className="relative">
                  <OwnImageThumb fileId={m.fileAssetId} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-none" />
                  {m.isPrimary && (
                    <Badge tone="primary" className="absolute left-2 top-2">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  {can.canMutateMedia && (
                    <div className="flex gap-1">
                      <RowAction label="Move earlier" disabled={!editable || i === 0} onClick={() => move(i, -1)}>
                        <ArrowLeftIcon />
                      </RowAction>
                      <RowAction label="Move later" disabled={!editable || i === images.length - 1} onClick={() => move(i, 1)}>
                        <ArrowRightIcon />
                      </RowAction>
                      <RowAction label="Make primary" tone="success" disabled={!editable || m.isPrimary} onClick={() => runOp({ kind: "primary", item: m })}>
                        <StarIcon />
                      </RowAction>
                      <RowAction label="Remove" tone="danger" disabled={!editable} onClick={() => setToDelete(m)}>
                        <TrashIcon />
                      </RowAction>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="docs-heading">
        <h3 id="docs-heading" className="mb-3 font-heading text-base font-bold text-foreground">
          Documents <span className="text-sm font-normal text-muted-foreground">({docs.length}/{M.DEFAULT_MAX_DOCUMENTS})</span>
        </h3>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents attached.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {docs.map((d) => (
              <li key={d.fileAssetId} className="flex items-center gap-3 px-4 py-3">
                <FileTextIcon className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{d.documentType || "Document"}</span>
                <FileDownloadAction fileId={d.fileAssetId} label="Open document" />
                {can.canMutateMedia && (
                  <RowAction label="Remove" tone="danger" disabled={!editable} onClick={() => setToDelete(d)}>
                    <TrashIcon />
                  </RowAction>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete?.mediaType === "IMAGE" ? "Remove photo?" : "Remove document?"}
        description={toDelete?.isPrimary ? "This is the primary photo — the next photo in order becomes primary." : "It will be removed from this listing."}
        confirmLabel="Remove"
        loading={op.isPending}
        onConfirm={() => toDelete && runOp({ kind: "delete", item: toDelete })}
      />
    </div>
  );
}

/**
 * Read-only photos for a listing without a draft. The seller media endpoint answers 409 then, so a live listing's
 * photos come from the public listing detail (public image downloads work for published listings). Paused or
 * archived listings aren't public, so their photos can't be shown.
 */
function PublishedMedia({ listing }: { listing: ListingDetailResponse }) {
  const live = listing.status === "PUBLISHED";
  const detail = useQuery({
    queryKey: ["listing", "public", listing.listingId],
    queryFn: ({ signal }) => listingsService.publicDetail(listing.listingId, signal),
    enabled: live,
    retry: false,
    staleTime: 60_000,
  });
  const note = <Notice>Photos and documents can only be changed on a draft. Published listings can't be edited through the seller portal yet.</Notice>;
  if (!live) return note;
  if (detail.isLoading) return <PageSkeleton />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} title="Couldn't load the live photos" />;
  const images = [...(detail.data?.galleryImages ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <div className="space-y-5">
      {note}
      <section aria-label="Live photos">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-heading text-base font-bold text-foreground">Photos buyers see</h3>
          <span className="text-xs text-muted-foreground">
            {images.length} photo{images.length === 1 ? "" : "s"} · view only
          </span>
        </div>
        {images.length === 0 ? (
          <EmptyState title="No photos on the live listing" description="This listing was published without photos." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img, i) => (
              <li key={img.fileAssetId} className="overflow-hidden rounded-xl border border-border bg-surface">
                <a href={assetUrl(img.cdnUrl) ?? undefined} target="_blank" rel="noreferrer" className="relative block" aria-label={`Open photo ${i + 1} in a new tab`}>
                  <ListingImage src={img.cdnUrl} alt={`${listing.currentDraftVersion?.title ?? listing.publishedVersion?.title ?? "Listing"} photo ${i + 1}`} className="aspect-[4/3] w-full" />
                  {img.isPrimary && (
                    <Badge tone="primary" className="absolute left-2 top-2">
                      <StarIcon className="size-3" weight="fill" aria-hidden /> Cover
                    </Badge>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
