import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { DetailList } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { DataTable } from "@/components/tables/data-table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatDateTime, humanize } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { InspectionSummaryDto, ListingDetailResponse, ListingModerationStatusResponse } from "@/api/types/seller-listings";
import { Notice } from "../components/notice";
import { Panel } from "../components/panel";
import { sellerErrorMessage } from "../lib/errors";
import { sellerKeys } from "../lib/queries";
import { toast } from "sonner";

interface Props {
  sellerId: string;
  listing: ListingDetailResponse;
  moderation: { data: ListingModerationStatusResponse | undefined; isLoading: boolean; error: unknown; refetch: () => unknown };
}

function ModerationCard({ moderation }: Pick<Props, "moderation">) {
  const m = moderation.data;
  return (
    <Panel title="Moderation" description="The latest decision from the StockOut review team.">
      <Notice className="mb-4">
        The marketplace can't currently report whether a draft is under review — its status always reads “Draft” while a draft exists. The latest decision below is
        reliable, but it may belong to an earlier submission.
      </Notice>
      {moderation.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : moderation.error ? (
        <ErrorState error={moderation.error} onRetry={() => void moderation.refetch()} title="Couldn't load moderation status" />
      ) : m ? (
        <DetailList
          items={[
            { label: "Latest decision", value: m.decision ? <StatusBadge value={m.decision === "APPROVE" ? "APPROVED" : m.decision === "REJECT" ? "REJECTED" : "CHANGES_REQUIRED"} /> : "No decision yet" },
            { label: "Reviewed", value: formatDateTime(m.reviewedAtUtc, "Not reviewed yet") },
            { label: "Reason", value: m.reasonCode ? humanize(m.reasonCode) : "—" },
            { label: "Reported status", value: <span className="text-muted-foreground">{humanize(m.status)} (may be inaccurate)</span> },
            { label: "Notes from the reviewer", value: m.sellerNotes ?? "—", full: true },
          ]}
        />
      ) : null}
    </Panel>
  );
}

function LatestInspection({ sellerId, listingId, requiresInspection }: { sellerId: string; listingId: string; requiresInspection?: boolean }) {
  const qc = useQueryClient();
  const [asking, setAsking] = React.useState(false);
  const latest = useQuery({ queryKey: sellerKeys.latestInspection(sellerId, listingId), queryFn: ({ signal }) => sellerListingsService.latestInspection(sellerId, listingId, signal) });
  const request = useApiMutation({
    toastOnError: false,
    mutationFn: ({ inspectionId, notes }: { inspectionId: string; notes: string }) => sellerListingsService.requestReinspection(sellerId, listingId, inspectionId, notes),
    successMessage: "Re-inspection requested. The marketplace team must approve it before an inspector is assigned.",
    onSuccess: () => {
      setAsking(false);
      void qc.invalidateQueries({ queryKey: sellerKeys.listing(sellerId, listingId) });
    },
  });

  if (latest.isLoading) return <Skeleton className="h-32 w-full" />;
  if (latest.error) return <ErrorState error={latest.error} onRetry={() => void latest.refetch()} title="Couldn't load the latest inspection" />;
  const i = latest.data;
  if (!i)
    return (
      <EmptyState
        className="py-8"
        title="No inspections yet"
        description={
          requiresInspection === true
            ? "This category needs a physical inspection. One is created automatically when your listing is approved, and an inspector will contact you."
            : requiresInspection === false
              ? "This listing's category doesn't need a physical inspection."
              : "If this category requires a physical inspection, one is created automatically when your listing is approved."
        }
      />
    );
  const canRequest = i.status === "COMPLETED" && (i.result === "FAIL" || i.result === "REINSPECTION_REQUIRED");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{i.inspectionNo}</span>
        <StatusBadge value={i.status} />
        {i.result && <StatusBadge value={i.result} />}
        {canRequest && (
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setAsking(true)}>
            <ArrowsClockwiseIcon /> Request re-inspection
          </Button>
        )}
      </div>
      <DetailList
        columns={3}
        items={[
          { label: "Created", value: formatDateTime(i.createdAtUtc) },
          { label: "Started", value: formatDateTime(i.startedAtUtc) },
          { label: "Completed", value: formatDateTime(i.completedAtUtc) },
          { label: "Summary", value: i.summary ?? "—", full: true },
          ...(i.failureReasonCode || i.failureNotes ? [{ label: "Failure", value: `${i.failureReasonCode ? humanize(i.failureReasonCode) : ""}${i.failureNotes ? ` — ${i.failureNotes}` : ""}`, full: true }] : []),
        ]}
      />
      {i.responses.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">Inspection checklist</caption>
            <thead className="bg-surface-muted text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Check</th>
                <th scope="col" className="px-4 py-2 font-medium">Result</th>
                <th scope="col" className="px-4 py-2 font-medium">Inspector notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...i.responses]
                .sort((a, b) => a.displayOrderSnapshot - b.displayOrderSnapshot)
                .map((r) => (
                  <tr key={r.inspectionResponseId}>
                    <td className="px-4 py-2">{r.itemLabelSnapshot}</td>
                    <td className="px-4 py-2">{r.itemResult ? <StatusBadge value={r.itemResult} /> : "—"}</td>
                    <td className="max-w-[320px] whitespace-normal px-4 py-2 text-muted-foreground">{r.inspectorNotes ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {i.evidence.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Evidence</p>
          <ul className="flex flex-wrap gap-2">
            {i.evidence.map((e) => (
              <li key={e.inspectionEvidenceId}>
                {e.downloadUrl ? (
                  <a href={e.downloadUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center rounded-md border border-secondary-border px-3 text-sm hover:bg-surface-muted">
                    {e.description || humanize(e.evidenceType)}
                  </a>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm text-muted-foreground">{e.description || humanize(e.evidenceType)} (unavailable)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ReasonDialog
        open={asking}
        onOpenChange={setAsking}
        tone="primary"
        title="Request re-inspection"
        description="Explain what you fixed. The marketplace team reviews the request before scheduling a new inspection."
        reasonLabel="Remediation notes"
        confirmLabel="Send request"
        loading={request.isPending}
        onConfirm={(notes) => request.mutate({ inspectionId: i.inspectionId, notes }, { onError: (e) => toast.error(sellerErrorMessage(e)) })}
      />
    </div>
  );
}

export function ReviewTab({ sellerId, listing, moderation }: Props) {
  const [page, setPage] = React.useState(1);
  const history = useQuery({
    queryKey: sellerKeys.inspections(sellerId, listing.listingId, page),
    queryFn: ({ signal }) => sellerListingsService.inspections(sellerId, listing.listingId, { page, pageSize: 10 }, signal),
    placeholderData: keepPreviousData,
  });
  const columns = React.useMemo<ColumnDef<InspectionSummaryDto, unknown>[]>(
    () => [
      { id: "no", header: "Inspection", cell: ({ row }) => <span className="font-mono text-xs">{row.original.inspectionNo}</span> },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { id: "result", header: "Result", cell: ({ row }) => (row.original.result ? <StatusBadge value={row.original.result} /> : "—") },
      { id: "created", header: "Created", cell: ({ row }) => formatDateTime(row.original.createdAtUtc) },
      { id: "completed", header: "Completed", cell: ({ row }) => formatDateTime(row.original.completedAtUtc) },
    ],
    [],
  );

  return (
    <div className="space-y-4 pt-1">
      <ModerationCard moderation={moderation} />
      <Panel title="Latest inspection">
        <LatestInspection sellerId={sellerId} listingId={listing.listingId} requiresInspection={(listing.currentDraftVersion ?? listing.publishedVersion)?.requiresPhysicalInspection} />
      </Panel>
      {/* History only adds information once at least one inspection exists (the panel above covers the empty case). */}
      {(history.isLoading || history.error || (history.data?.items.length ?? 0) > 0) && (
        <Panel title="Inspection history">
          <DataTable
            caption="Inspection history"
            columns={columns}
            data={history.data?.items}
            getRowId={(r) => r.inspectionId}
            isLoading={history.isLoading}
            isFetching={history.isFetching}
            error={history.error}
            onRetry={() => void history.refetch()}
            pagination={{ page, pageSize: 10, totalCount: history.data?.totalCount ?? 0, onPageChange: setPage, onPageSizeChange: () => setPage(1) }}
            pageSizeOptions={[10]}
            emptyTitle="No inspections yet"
          />
        </Panel>
      )}
    </div>
  );
}
