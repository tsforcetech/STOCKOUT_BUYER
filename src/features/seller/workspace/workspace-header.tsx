import * as React from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ListChecksIcon,
  PaperPlaneTiltIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatDateTime } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import {
  getSellerListingActions,
  type ListingDetailResponse,
  type ListingModerationStatusResponse,
} from "@/api/types/seller-listings";
import { useListingLifecycle } from "../components/listing-lifecycle";
import { Notice } from "../components/notice";
import { sellerErrorMessage } from "../lib/errors";
import { LISTING_STATUS_LABELS } from "../lib/listing";
import { useListingRequirements } from "../lib/queries";
import { ValidateDialog } from "./validate-dialog";

interface Props {
  sellerId: string;
  listing: ListingDetailResponse;
  moderation: ListingModerationStatusResponse | undefined;
}

export function WorkspaceHeader({ sellerId, listing, moderation }: Props) {
  const version = listing.currentDraftVersion ?? listing.publishedVersion;
  const can = getSellerListingActions(listing);
  const lifecycle = useListingLifecycle(sellerId);
  const req = useListingRequirements(listing.currentDraftVersion?.categoryId);
  const [validateOpen, setValidateOpen] = React.useState(false);
  const validate = useApiMutation({
    mutationFn: () =>
      sellerListingsService.validate(sellerId, listing.listingId),
    toastOnError: false,
    onSuccess: () => setValidateOpen(true),
  });

  const target = { listingId: listing.listingId, title: version?.title ?? "" };
  const rejected =
    moderation?.decision === "REJECT" && !!listing.currentDraftVersionId;
  const changesRequested =
    moderation?.decision === "REQUEST_CHANGES" &&
    !!listing.currentDraftVersionId;
  // Approved drafts stay "DRAFT" until an admin publishes them (moderation-status never reports APPROVED, backend A1).
  const approvedAwaitingPublish =
    moderation?.decision === "APPROVE" &&
    listing.status === "DRAFT" &&
    !!listing.currentDraftVersionId;

  return (
    <>
      <PageHeader
        eyebrow="Seller portal · Listing"
        title={version?.title || "Untitled listing"}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/seller/listings">
                <ArrowLeftIcon /> Listings
              </Link>
            </Button>
            {listing.currentDraftVersionId && listing.status === "DRAFT" && (
              <Button
                variant="secondary"
                loading={validate.isPending}
                onClick={() =>
                  validate.mutate(undefined, {
                    onError: (e) => toast.error(sellerErrorMessage(e)),
                  })
                }
              >
                <ListChecksIcon /> Check completeness
              </Button>
            )}
            {can.canSubmit && !rejected && !approvedAwaitingPublish && (
              <Button
                variant="primary"
                onClick={() => lifecycle.open("submit", target)}
              >
                <PaperPlaneTiltIcon /> Submit for review
              </Button>
            )}
            {can.canPause && (
              <Button
                variant="secondary"
                onClick={() => lifecycle.open("pause", target)}
              >
                <PauseIcon /> Pause
              </Button>
            )}
            {can.canResume && (
              <Button
                variant="primary"
                onClick={() => lifecycle.open("resume", target)}
              >
                <PlayIcon /> Resume
              </Button>
            )}
            {can.canArchive && listing.status !== "ARCHIVED" && (
              <Button
                variant="danger-ghost"
                onClick={() => lifecycle.open("archive", target)}
              >
                <ArchiveIcon /> Archive
              </Button>
            )}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge
            value={listing.status}
            label={LISTING_STATUS_LABELS[listing.status]}
          />
          {version && <span>Version {version.versionNumber}</span>}
          <span className="font-mono">
            LST-{listing.listingId.slice(0, 8).toUpperCase()}
          </span>
          {listing.expiresAtUtc && (
            <span>Expires {formatDateTime(listing.expiresAtUtc)}</span>
          )}
        </div>
      </PageHeader>

      <div className="mb-4 space-y-3">
        {listing.status === "PUBLISHED" && (
          <Notice tone="info" title="Live listings can't be edited">
            The marketplace doesn't yet support editing a published listing —
            title, price, attributes and photos are locked. You can still update
            stock, pause it, or pause and then archive it.
          </Notice>
        )}
        {listing.status === "SUSPENDED" && (
          <Notice tone="warning" title="This listing is hidden from buyers">
            If you paused it, you can resume it. If the marketplace team
            suspended it, resuming is blocked — contact support. Resuming needs
            a verified seller account, stock above 0 and a primary image.
          </Notice>
        )}
        {listing.status === "EXPIRED" && (
          <Notice tone="warning" title="This listing has expired">
            Expired listings can't be edited or republished. You can archive it.
          </Notice>
        )}
        {listing.status === "ARCHIVED" && (
          <Notice title="Archived">
            This listing is archived permanently and is read-only.
          </Notice>
        )}
        {rejected && (
          <Notice tone="danger" title="This listing was rejected">
            A rejected listing can't be edited or resubmitted — the only option
            is to archive it and create a new listing.
            {moderation?.sellerNotes && (
              <span className="mt-1 block">
                Reviewer notes: “{moderation.sellerNotes}”
              </span>
            )}
          </Notice>
        )}
        {approvedAwaitingPublish && (
          <Notice tone="info" title="Approved — waiting to be published">
            A StockOut reviewer approved this listing on{" "}
            {formatDateTime(moderation?.reviewedAtUtc)}. It goes live as soon as
            the marketplace team publishes it; no action is needed from you.
            {moderation?.sellerNotes && (
              <span className="mt-1 block">
                Reviewer notes: “{moderation.sellerNotes}”
              </span>
            )}
          </Notice>
        )}
        {changesRequested && (
          <Notice tone="warning" title="Changes requested">
            Update the draft as requested, then submit it again. (Reviewed{" "}
            {formatDateTime(moderation?.reviewedAtUtc)} — if you've resubmitted
            since then, it's back in the queue.)
            {moderation?.sellerNotes && (
              <span className="mt-1 block">
                Reviewer notes: “{moderation.sellerNotes}”
              </span>
            )}
          </Notice>
        )}
      </div>

      {lifecycle.dialogs}
      <ValidateDialog
        result={validate.data}
        attributes={req.data?.attributes ?? []}
        open={validateOpen}
        onOpenChange={setValidateOpen}
      />
    </>
  );
}
