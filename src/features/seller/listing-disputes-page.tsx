import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDateTime } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import { DISPUTE_REASONS } from "@/api/types/disputes";
import { BackLink } from "./components/back-link";
import { Notice } from "./components/notice";
import { ListingAccessNotice, canManageListings } from "./components/listing-access-notice";
import { sellerErrorMessage } from "./lib/errors";
import { useActiveSeller, useListingDetail } from "./lib/queries";
import { DisputeStatusBadge, disputeKeys } from "./lib/disputes";

const utc = (v: string | null | undefined) => (v ? formatDateTime(v.endsWith("Z") ? v : `${v}Z`) : "—");
const reasonLabel = (code: string) => DISPUTE_REASONS.find((r) => r.code === code)?.label ?? code;

function DisputeDetail({ sellerId, listingId, disputeId }: { sellerId: string; listingId: string; disputeId: string }) {
  const q = useQuery({ queryKey: disputeKeys.one(sellerId, listingId, disputeId), queryFn: ({ signal }) => sellerListingsService.dispute(sellerId, listingId, disputeId, signal) });
  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data) return <ErrorState error={q.error} title={q.error ? sellerErrorMessage(q.error) : "Dispute not found"} onRetry={() => void q.refetch()} />;
  const d = q.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{d.disputeNo}</span>
        <DisputeStatusBadge status={d.status} />
        <span className="text-xs text-muted-foreground">{d.disputeType === "INSPECTION_APPEAL" ? "Inspection appeal" : "Dispute after declining a proposal"}</span>
      </div>
      {d.status === "SUBMITTED" && <Notice title="Under review">A StockOut reviewer who wasn't involved in the inspection will decide. Publishing is paused for this inspection until then.</Notice>}
      {d.status === "APPROVED_FOR_REINSPECTION" && (
        <Notice title="Re-inspection approved">
          {d.decisionNotes}
          {d.authorizedReinspectionNo && <span className="mt-1 block">New inspection {d.authorizedReinspectionNo} will be done by a different inspector.</span>}
        </Notice>
      )}
      {d.status === "REJECTED" && <Notice tone="warning" title="Dispute rejected">{d.decisionNotes ?? "The original inspection result stands."}</Notice>}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Inspection</dt>
          <dd>
            {d.inspectionNo ?? d.inspectionId.slice(0, 8)} · result {d.disputedInspectionResult} · completed {utc(d.inspectionCompletedAtUtc)}
          </dd>
        </div>
        {d.correctionNo && (
          <div>
            <dt className="text-xs text-muted-foreground">Declined proposal</dt>
            <dd>
              <Link className="underline underline-offset-4" to={`/seller/listings/${listingId}/corrections/${d.correctionId}`}>
                {d.correctionNo}
              </Link>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Sent</dt>
          <dd>{utc(d.submittedAtUtc)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Decided</dt>
          <dd>{utc(d.decidedAtUtc)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Your reason · {reasonLabel(d.reasonCode)}</dt>
          <dd className="whitespace-pre-wrap">{d.sellerReason}</dd>
        </div>
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Your evidence</h3>
        <ul className="space-y-1">
          {d.evidence.map((e) => (
            <li key={e.disputeEvidenceId} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{e.description ?? (e.evidenceType === "IMAGE" ? "Photo" : "Document")}</span>
              {e.downloadUrl ? (
                <a className="inline-flex items-center gap-1 text-xs underline underline-offset-4" href={e.downloadUrl} target="_blank" rel="noreferrer">
                  <DownloadSimpleIcon className="size-4" /> Open
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">Link unavailable — reload</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function SellerListingDisputesPage() {
  const { listingId = "" } = useParams();
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const [state, setState] = useUrlState({ dispute: "" });
  const listing = useListingDetail(sellerId, listingId);
  const q = useQuery({
    queryKey: disputeKeys.forListing(sellerId, listingId),
    queryFn: ({ signal }) => sellerListingsService.disputes(sellerId, listingId, signal),
    enabled: canManageListings(seller),
  });
  if (!canManageListings(seller))
    return (
      <>
        <PageHeader eyebrow="Seller portal" title="Inspection disputes" />
        <ListingAccessNotice seller={seller} />
      </>
    );
  const items = [...(q.data ?? [])].sort((a, b) => b.submittedAtUtc.localeCompare(a.submittedAtUtc));
  const selected = state.dispute || items[0]?.disputeId || "";
  const title = (listing.data?.currentDraftVersion ?? listing.data?.publishedVersion)?.title;
  return (
    <>
      <BackLink to={`/seller/listings/${listingId}?tab=review`}>Listing</BackLink>
      <PageHeader eyebrow="Seller portal · Inspection disputes" title={title ?? "Inspection disputes"} description="Appeals of inspection results and disputes after declining an inspector's proposal." />
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.error ? (
        <ErrorState error={q.error} title={sellerErrorMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <SectionCard>
          <EmptyState title="No disputes" description="You can appeal a completed inspection from the listing's Review tab, or dispute after declining an inspector's proposal." />
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <SectionCard>
            <ul className="space-y-1">
              {items.map((d) => (
                <li key={d.disputeId}>
                  <button
                    type="button"
                    onClick={() => setState({ dispute: d.disputeId })}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted ${d.disputeId === selected ? "bg-surface-muted" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">{d.disputeNo}</span>
                      <DisputeStatusBadge status={d.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {d.inspectionNo} · {utc(d.submittedAtUtc)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard>{selected && <DisputeDetail key={selected} sellerId={sellerId} listingId={listingId} disputeId={selected} />}</SectionCard>
        </div>
      )}
    </>
  );
}
