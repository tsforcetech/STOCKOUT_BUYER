import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PaperclipIcon, TrashIcon } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { filesService } from "@/services/files.service";
import { sellerListingsService } from "@/services/seller-listings.service";
import { DISPUTE_REASONS, type DisputeStatus, type DisputeType, type SellerInspectionDisputeDetailDto } from "@/api/types/disputes";
import { Notice } from "../components/notice";
import { sellerErrorMessage } from "./errors";
import { sellerKeys } from "./queries";

export const disputeKeys = {
  forListing: (sellerId: string, listingId: string) => [...sellerKeys.listing(sellerId, listingId), "disputes"] as const,
  one: (sellerId: string, listingId: string, disputeId: string) => [...sellerKeys.listing(sellerId, listingId), "disputes", disputeId] as const,
};

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  SUBMITTED: "Under review",
  APPROVED_FOR_REINSPECTION: "Re-inspection approved",
  REJECTED: "Rejected",
};

export function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  return <StatusBadge value={status === "APPROVED_FOR_REINSPECTION" ? "APPROVED" : status === "SUBMITTED" ? "UNDER_REVIEW" : status} label={DISPUTE_STATUS_LABEL[status] ?? status} />;
}

interface Evidence {
  fileAssetId: string;
  name: string;
  type: "IMAGE" | "DOCUMENT";
}

/**
 * Appeal an inspection result, or dispute it after declining a correction. Evidence is uploaded as a PRIVATE
 * SELLER_DOCUMENT (never LISTING_IMAGE) and must finish uploading before it's attached.
 */
export function DisputeDialog({
  sellerId,
  listingId,
  inspectionId,
  inspectionNo,
  disputeType,
  correctionId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  sellerId: string;
  listingId: string;
  inspectionId: string;
  inspectionNo?: string | null;
  disputeType: DisputeType;
  correctionId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (d: SellerInspectionDisputeDetailDto) => void;
}) {
  const qc = useQueryClient();
  const [reasonCode, setReasonCode] = React.useState(DISPUTE_REASONS[0]!.code);
  const [reason, setReason] = React.useState("");
  const [files, setFiles] = React.useState<Evidence[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const submit = useApiMutation({
    toastOnError: false,
    successMessage: "Dispute sent. StockOut will review it.",
    mutationFn: () =>
      sellerListingsService.submitDispute(sellerId, listingId, inspectionId, {
        disputeType,
        correctionId: correctionId ?? null,
        reasonCode,
        reason: reason.trim(),
        evidence: files.map((f, i) => ({ fileAssetId: f.fileAssetId, evidenceType: f.type, filePurpose: "SELLER_DOCUMENT", description: f.name, displayOrder: i + 1 })),
      }),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: disputeKeys.forListing(sellerId, listingId) });
      onSubmitted(d);
    },
  });

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(list)) {
        const asset = await filesService.upload(file, "SELLER_DOCUMENT");
        setFiles((prev) => [...prev, { fileAssetId: asset.fileId, name: file.name, type: file.type.startsWith("image/") ? "IMAGE" : "DOCUMENT" }]);
      }
    } catch (e) {
      setUploadError(sellerErrorMessage(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const ready = reason.trim().length >= 10 && files.length > 0 && !uploading;
  return (
    <Dialog open={open} onOpenChange={(o) => !submit.isPending && onOpenChange(o)}>
      <DialogContent
        title={disputeType === "INSPECTION_APPEAL" ? "Appeal the inspection result" : "Dispute this inspection"}
        description={`${inspectionNo ? `${inspectionNo}. ` : ""}A reviewer who wasn't involved in the inspection decides. If they approve, a different inspector re-inspects. You can raise one dispute per inspection.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
              Cancel
            </Button>
            <Button variant="primary" loading={submit.isPending} disabled={!ready} onClick={() => submit.mutate()}>
              Send dispute
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {submit.error ? <Notice tone="danger">{sellerErrorMessage(submit.error)}</Notice> : null}
          <FormField label="What's wrong?" htmlFor="dispute-reason-code" required>
            <NativeSelect value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {DISPUTE_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Explain" htmlFor="dispute-reason" required hint={`At least 10 characters · ${reason.length}/2000`}>
            <Textarea rows={4} value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">
              Evidence <span className="text-danger">*</span>
            </p>
            <p className="mb-2 text-xs text-muted-foreground">PDF, JPG or PNG up to 20 MB. Files stay private — only StockOut reviewers see them.</p>
            {files.length > 0 && (
              <ul className="mb-2 space-y-1">
                {files.map((f) => (
                  <li key={f.fileAssetId} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                    <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-danger" onClick={() => setFiles((prev) => prev.filter((x) => x.fileAssetId !== f.fileAssetId))}>
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input ref={input} type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only" aria-label="Add evidence files" onChange={(e) => void add(e.target.files)} />
            <Button variant="secondary" size="sm" loading={uploading} onClick={() => input.current?.click()}>
              <PaperclipIcon /> Add files
            </Button>
            {uploadError && <p className="mt-1 text-xs text-danger">{uploadError}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
