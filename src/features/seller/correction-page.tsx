import * as React from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatDateTime } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import { CORRECTION_DECLINE_REASON_MAX, type SellerCorrectionDecisionResponse, type SellerListingCorrectionDto } from "@/api/types/listing-corrections";
import { BackLink } from "./components/back-link";
import { Notice } from "./components/notice";
import { ListingAccessNotice, canManageListings } from "./components/listing-access-notice";
import { errorCode, sellerErrorMessage } from "./lib/errors";
import { sellerKeys, useActiveSeller, useListingDetail } from "./lib/queries";
import { CorrectionChanges, CorrectionStatusBadge, FIELD_LABEL, correctionKeys } from "./lib/corrections";

const utc = (v: string | null | undefined) => (v ? formatDateTime(v.endsWith("Z") ? v : `${v}Z`) : "—");

/** What happened after the seller's decision, in plain words. */
function Outcome({ result, onReinspect, unpublished }: { result: SellerCorrectionDecisionResponse; onReinspect: () => void; unpublished: boolean }) {
  if (result.correction.sellerDecision === "ACCEPT") {
    if (result.moderationEntryStatus === "SUBMITTED_TO_MODERATION")
      return (
        <Notice title="Accepted — sent for review" className="mb-4">
          A new version with these changes is with StockOut's reviewers. Your live listing stays as it is until that version is approved and published.
        </Notice>
      );
    return (
      <Notice tone="warning" title="Accepted — waiting to go to review" className="mb-4">
        Your acceptance is recorded, but the changes couldn't be sent for review yet.{" "}
        {unpublished
          ? "This listing hasn't been published yet, and corrections to unpublished listings can't go to review yet — StockOut will follow up."
          : result.moderationEntryBlockedCode === "MARKETPLACE_CORRECTION_LISTING_DRAFT_CONFLICT"
          ? "You have an unfinished update on this listing — submit or finish it first; StockOut then sends these changes for review."
          : "StockOut will follow up and send them for review."}
      </Notice>
    );
  }
  return (
    <Notice tone="info" title="Declined" className="mb-4" action={result.reinspectionRequestEligible ? <Button size="sm" variant="secondary" onClick={onReinspect}>Request re-inspection</Button> : undefined}>
      Your listing stays as it is.{" "}
      {result.reinspectionRequestEligible
        ? "If you disagree with the inspection result, you can ask for a re-inspection."
        : "If you want to dispute the inspection, contact StockOut support — there's no online appeal for this case yet."}
    </Notice>
  );
}

function DecisionHistory({ c }: { c: SellerListingCorrectionDto }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted-foreground">Proposed</dt>
        <dd>{utc(c.createdAtUtc)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Your decision</dt>
        <dd>{c.sellerDecision ? `${c.sellerDecision === "ACCEPT" ? "Accepted" : "Declined"} · ${utc(c.sellerDecisionAtUtc)}` : "Not decided yet"}</dd>
      </div>
      {c.sellerDecisionReason && (
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Your reason</dt>
          <dd className="whitespace-pre-wrap">{c.sellerDecisionReason}</dd>
        </div>
      )}
      {c.disputeRequestedAtUtc && (
        <div>
          <dt className="text-xs text-muted-foreground">Dispute noted</dt>
          <dd>{utc(c.disputeRequestedAtUtc)}</dd>
        </div>
      )}
    </dl>
  );
}

export default function SellerCorrectionPage() {
  const { listingId = "", correctionId = "" } = useParams();
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const qc = useQueryClient();
  const listing = useListingDetail(sellerId, listingId);
  const q = useQuery({
    queryKey: correctionKeys.one(sellerId, correctionId),
    queryFn: ({ signal }) => sellerListingsService.correction(sellerId, listingId, correctionId, signal),
    enabled: canManageListings(seller),
  });
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [acceptOpen, setAcceptOpen] = React.useState(false);
  const [reinspectOpen, setReinspectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [result, setResult] = React.useState<SellerCorrectionDecisionResponse | null>(null);

  const decide = useApiMutation({
    mutationFn: (decision: "ACCEPT" | "DECLINE") =>
      sellerListingsService.decideCorrection(sellerId, listingId, correctionId, { decision, reason: decision === "DECLINE" ? reason.trim() : null, expectedRowVersion: q.data?.rowVersion ?? null }),
    toastOnError: false,
    onSuccess: (r) => {
      setResult(r);
      setAcceptOpen(false);
      setDeclineOpen(false);
      qc.setQueryData(correctionKeys.one(sellerId, correctionId), r.correction);
      void qc.invalidateQueries({ queryKey: correctionKeys.all(sellerId) });
      void qc.invalidateQueries({ queryKey: sellerKeys.listing(sellerId, listingId) });
    },
  });
  const onDecideError = (e: unknown) => {
    if (errorCode(e) === "MARKETPLACE_CORRECTION_VERSION_CONFLICT") void q.refetch();
  };
  const reinspect = useApiMutation({
    mutationFn: () => sellerListingsService.requestReinspection(sellerId, listingId, q.data!.inspectionId, notes.trim()),
    successMessage: "Re-inspection requested.",
    toastOnError: false,
    onSuccess: () => setReinspectOpen(false),
  });

  if (!canManageListings(seller))
    return (
      <>
        <PageHeader eyebrow="Seller portal" title="Inspector proposal" />
        <ListingAccessNotice seller={seller} />
      </>
    );
  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data)
    return (
      <SectionCard>
        <ErrorState error={q.error} title={q.error ? sellerErrorMessage(q.error) : "Proposal not found"} onRetry={() => void q.refetch()} />
      </SectionCard>
    );

  const c = q.data;
  const version = listing.data?.currentDraftVersion ?? listing.data?.publishedVersion;
  const open = c.status === "AWAITING_SELLER_DECISION";
  const needsOk = c.changes.filter((x) => x.requiresSellerAcceptance);

  return (
    <>
      <BackLink to="/seller/corrections">Inspector proposals</BackLink>
      <PageHeader
        eyebrow={`Seller portal · ${c.correctionNo}`}
        title={version?.title ?? "Inspector proposal"}
        actions={
          open ? (
            <>
              <Button variant="secondary" onClick={() => setDeclineOpen(true)}>
                <XIcon /> Decline
              </Button>
              <Button variant="primary" onClick={() => setAcceptOpen(true)}>
                <CheckIcon /> Accept changes
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <CorrectionStatusBadge status={c.status} />
          <Link className="underline underline-offset-4" to={`/seller/listings/${c.listingId}`}>
            Open listing
          </Link>
        </div>
      </PageHeader>

      {result && <Outcome result={result} onReinspect={() => setReinspectOpen(true)} unpublished={listing.data?.publishedVersionId == null} />}
      {!result && c.status === "SUBMITTED_TO_MODERATION" && (
        <Notice className="mb-4" title="In review">
          You accepted these changes and they're with StockOut's reviewers. Your live listing stays as it is until they're approved and published.
        </Notice>
      )}
      {!result && c.status === "SELLER_ACCEPTED" && (
        <Notice tone="warning" className="mb-4" title="Accepted — waiting to go to review">
          Your acceptance is recorded. StockOut will send these changes for review.
        </Notice>
      )}
      {!result && c.status === "WITHDRAWN" && <Notice className="mb-4">StockOut withdrew this proposal. Nothing changes on your listing.</Notice>}
      {decide.error ? (
        <Notice tone="danger" className="mb-4">
          {sellerErrorMessage(decide.error)}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard>
          <h2 className="mb-1 font-heading text-base font-bold">What the inspector found</h2>
          <p className="mb-4 whitespace-pre-wrap text-sm">{c.sellerVisibleSummary}</p>
          <h2 className="mb-2 font-heading text-base font-bold">Proposed changes</h2>
          <CorrectionChanges changes={c.changes} categoryId={version?.categoryId} />
          {c.changes.some((x) => x.field === "quantity") && c.quantityApplicationStatus === "BLOCKED_PENDING_OWNER_DECISION" && (
            <p className="mt-3 text-xs text-muted-foreground">Stock level is not changed automatically — the proposed quantity is recorded for reference only.</p>
          )}
        </SectionCard>
        <SectionCard>
          <h2 className="mb-3 font-heading text-base font-bold">Decision</h2>
          <DecisionHistory c={c} />
          {open && needsOk.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {needsOk.map((x) => FIELD_LABEL[x.field] ?? x.field).join(", ")} {needsOk.length === 1 ? "changes" : "change"} only with your OK.
            </p>
          )}
        </SectionCard>
      </div>

      <Dialog open={acceptOpen} onOpenChange={(o) => !decide.isPending && setAcceptOpen(o)}>
        <DialogContent
          title="Accept these changes?"
          description="A new version of your listing with these changes goes to StockOut's reviewers. Buyers keep seeing your current listing until it's approved and published."
          footer={
            <>
              <Button variant="secondary" onClick={() => setAcceptOpen(false)} disabled={decide.isPending}>
                Cancel
              </Button>
              <Button variant="primary" loading={decide.isPending} onClick={() => decide.mutate("ACCEPT", { onError: onDecideError })}>
                Accept
              </Button>
            </>
          }
        >
          <CorrectionChanges changes={c.changes} categoryId={version?.categoryId} />
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={(o) => !decide.isPending && setDeclineOpen(o)}>
        <DialogContent
          title="Decline these changes?"
          description="Your listing stays as it is. Tell StockOut why — it's kept with the inspection record."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeclineOpen(false)} disabled={decide.isPending}>
                Cancel
              </Button>
              <Button variant="danger" loading={decide.isPending} disabled={!reason.trim()} onClick={() => decide.mutate("DECLINE", { onError: onDecideError })}>
                Decline
              </Button>
            </>
          }
        >
          <FormField label="Reason" htmlFor="decline-reason" required hint={`${reason.length}/${CORRECTION_DECLINE_REASON_MAX}`}>
            <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={CORRECTION_DECLINE_REASON_MAX} />
          </FormField>
        </DialogContent>
      </Dialog>

      <Dialog open={reinspectOpen} onOpenChange={(o) => !reinspect.isPending && setReinspectOpen(o)}>
        <DialogContent
          title="Request re-inspection"
          description="Explain what you've fixed or why the result should be checked again."
          footer={
            <>
              <Button variant="secondary" onClick={() => setReinspectOpen(false)} disabled={reinspect.isPending}>
                Cancel
              </Button>
              <Button variant="primary" loading={reinspect.isPending} disabled={!notes.trim()} onClick={() => reinspect.mutate()}>
                Request
              </Button>
            </>
          }
        >
          {reinspect.error ? <Notice tone="danger" className="mb-3">{sellerErrorMessage(reinspect.error)}</Notice> : null}
          <FormField label="Notes" htmlFor="reinspect-notes" required>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </DialogContent>
      </Dialog>
    </>
  );
}
