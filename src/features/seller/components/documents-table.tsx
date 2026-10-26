import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, TrashIcon } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { RowAction } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { isApiError } from "@/lib/api/errors";
import { formatDate, humanize } from "@/lib/utils/format";
import { marketplaceService } from "@/services/marketplace.service";
import type { SellerDocumentResponse } from "@/api/types/user-organization";
import { sellerAccountErrorMessage } from "../lib/errors";
import { sellerKeys } from "../lib/queries";
import { FileDownloadAction } from "./file-link";
import { GENERIC_VAT_TYPE, categoryOf, kycTypeLabel, signatoryParts } from "../lib/kyc";
import { toast } from "sonner";

export function useSellerDocuments(sellerId: string) {
  return useQuery({ queryKey: sellerKeys.documents(sellerId), queryFn: ({ signal }) => marketplaceService.documents(sellerId, signal) });
}

/** Free-text types typed by sellers stay as written; backend-style codes (TRADE_LICENSE) are made readable. */
export function documentTypeLabel(type: string): string {
  const known = kycTypeLabel(type);
  if (known) return known;
  if (!/^[A-Z0-9_]+$/.test(type)) return type;
  return humanize(type).replace(/\b(Vat|Id|Trn|Moa|Uae)\b/g, (w) => w.toUpperCase());
}

export function DocumentsTable({ sellerId, canDelete, emptyAction }: { sellerId: string; canDelete: boolean; emptyAction?: React.ReactNode }) {
  const qc = useQueryClient();
  const docs = useSellerDocuments(sellerId);
  const [toDelete, setToDelete] = React.useState<SellerDocumentResponse | null>(null);

  const remove = useApiMutation({
    toastOnError: false,
    mutationFn: async (doc: SellerDocumentResponse) => {
      try {
        await marketplaceService.deleteDocument(sellerId, doc.sellerDocumentId);
      } catch (error) {
        // Backend defect: DELETE answers 404 even when the row was deleted. Verify by re-reading the list.
        if (!(isApiError(error) && error.status === 404)) throw error;
      }
      const fresh = await qc.fetchQuery({ queryKey: sellerKeys.documents(sellerId), queryFn: ({ signal }) => marketplaceService.documents(sellerId, signal), staleTime: 0 });
      if (fresh.some((d) => d.sellerDocumentId === doc.sellerDocumentId)) throw new Error("The document could not be deleted. Please try again.");
    },
    successMessage: "Document deleted.",
    onSuccess: () => setToDelete(null),
  });

  const list = docs.data ?? [];
  let body: React.ReactNode;
  if (docs.isLoading) {
    body = (
      <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Loading documents">
        {Array.from({ length: 2 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    );
  } else if (docs.error) {
    body = <ErrorState error={docs.error} onRetry={() => void docs.refetch()} title="Couldn't load your documents" />;
  } else if (!list.length) {
    body = (
      <EmptyState
        className="rounded-lg border border-dashed border-border-strong py-10"
        icon={<FileTextIcon />}
        title="No documents yet"
        description="Upload your trade licence, Emirates ID or VAT certificate so we can verify your account."
        action={emptyAction}
      />
    );
  } else {
    body = (
      <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Verification documents">
        {list.map((d) => {
          const expired = !!d.expiresAt && new Date(d.expiresAt).getTime() < Date.now();
          const meta = [
            d.documentNumber ? `No. ${d.documentNumber}` : null,
            d.issuedAt ? `Issued ${formatDate(d.issuedAt)}` : null,
            d.expiresAt ? `${expired ? "Expired" : "Expires"} ${formatDate(d.expiresAt)}` : null,
            `Added ${formatDate(d.createdAtUtc)}`,
            d.reviewedAtUtc ? `Reviewed ${formatDate(d.reviewedAtUtc)}` : null,
          ].filter(Boolean);
          const parts = categoryOf(d.documentType) === "SIGNATORY" ? signatoryParts(d) : null;
          const partsLabel = parts && [parts.id && "Signatory ID", parts.authority && "Authority proof"].filter(Boolean).join(" + ");
          const generic = d.documentType.toUpperCase() === GENERIC_VAT_TYPE;
          const legacy = !categoryOf(d.documentType) && d.documentType.toUpperCase() !== "OTHER";
          return (
            <li key={d.sellerDocumentId} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:flex-nowrap sm:p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground ring-1 ring-border" aria-hidden>
                <FileTextIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium text-foreground">{documentTypeLabel(d.documentType)}</p>
                  <StatusBadge value={d.verificationStatus} />
                  {expired && <Badge tone="danger">Expired</Badge>}
                  {partsLabel && <Badge tone="neutral">{partsLabel}</Badge>}
                  {generic && <Badge tone="warning">Needs classification</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</p>
                {d.verificationStatus === "REJECTED" && (
                  <p className="mt-1 text-xs text-danger">Rejected{d.reviewRemark ? `: ${d.reviewRemark}` : ""}. Upload a corrected document.</p>
                )}
                {d.verificationStatus === "VERIFIED" && d.reviewRemark && <p className="mt-1 text-xs text-muted-foreground">Reviewer note: {d.reviewRemark}</p>}
                {generic && d.verificationStatus !== "REJECTED" && (
                  <p className="mt-1 text-xs text-muted-foreground">Uploaded as a general VAT document — our reviewers will classify it, or you can upload it again with the exact type.</p>
                )}
                {legacy && d.verificationStatus === "UNVERIFIED" && (
                  <p className="mt-1 text-xs text-muted-foreground">Uploaded before the document checklist — it doesn't count towards a requirement. Re-upload it under the right requirement.</p>
                )}
              </div>
              <div className="ml-auto flex shrink-0 gap-1.5">
                <FileDownloadAction fileId={d.fileAssetId} label="Open document" />
                {canDelete && d.verificationStatus !== "VERIFIED" && (
                  <RowAction label="Delete document" tone="danger" onClick={() => setToDelete(d)}>
                    <TrashIcon />
                  </RowAction>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      {body}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete document?"
        description={`“${toDelete ? documentTypeLabel(toDelete.documentType) : ""}” will be removed from your verification documents.`}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete, { onError: (e) => toast.error(sellerAccountErrorMessage(e)) })}
      />
    </>
  );
}
