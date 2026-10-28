import * as React from "react";
import { CheckCircleIcon, FileArrowUpIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { FILE_LIMITS, filesService } from "@/services/files.service";
import { marketplaceService } from "@/services/marketplace.service";
import type { CreateSellerDocumentRequest, SellerDocumentResponse } from "@/api/types/user-organization";
import { kycTypeLabel } from "../lib/kyc";
import { cn } from "@/lib/utils/cn";

const ACCEPT = FILE_LIMITS.SELLER_DOCUMENT.accept;
const MAX_BYTES = FILE_LIMITS.SELLER_DOCUMENT.maxBytes;

export function checkFile(file: File): string | null {
  if (!ACCEPT.split(",").includes(file.type)) return "Upload a PDF, JPG or PNG file.";
  if (file.size > MAX_BYTES) return `The file must be ${formatBytes(MAX_BYTES)} or smaller.`;
  return null;
}

/** Uploads the file (purpose SELLER_DOCUMENT) and records it as a seller document. */
export async function uploadDocument(sellerId: string, file: File, body: Omit<CreateSellerDocumentRequest, "fileAssetId">): Promise<SellerDocumentResponse> {
  const asset = await filesService.upload(file, "SELLER_DOCUMENT");
  return marketplaceService.addDocument(sellerId, { ...body, fileAssetId: asset.fileId });
}

/**
 * One document next to the details it belongs to. Shows what's already on file (so nothing is asked twice),
 * or lets the seller pick a file that's uploaded when the step is saved.
 */
export function FileSlot({
  id,
  label,
  hint,
  existing,
  file,
  onFile,
  error,
  disabled,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  existing?: SellerDocumentResponse;
  file: File | null;
  onFile: (file: File | null) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = React.useState(false);
  const showExisting = existing && !file && !replacing;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground" id={`${id}-label`}>
        {label}
      </p>
      {showExisting ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success-soft/40 px-3 py-2.5 text-sm">
          <CheckCircleIcon className="size-5 shrink-0 text-success" weight="fill" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">{kycTypeLabel(existing.documentType) ?? existing.documentType} uploaded</span>
            <span className="text-xs text-muted-foreground">Added {formatDate(existing.createdAtUtc)}</span>
          </span>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplacing(true)}>
              Replace
            </Button>
          )}
        </div>
      ) : file ? (
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
          <FileArrowUpIcon className="size-5 shrink-0 text-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatBytes(file.size)} · uploads when you continue</span>
          </span>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${file.name}`} onClick={() => onFile(null)}>
              <XIcon />
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          aria-labelledby={`${id}-label`}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left text-sm transition-colors hover:bg-surface-muted disabled:cursor-not-allowed",
            error ? "border-danger" : "border-border-strong",
          )}
        >
          <FileArrowUpIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">Choose file</span>
            <span className="text-xs text-muted-foreground">PDF, JPG or PNG, up to {formatBytes(MAX_BYTES)}</span>
          </span>
        </button>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (f) {
            setReplacing(false);
            onFile(f);
          }
        }}
      />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {replacing && existing && !file && (
        <button type="button" className="cursor-pointer text-xs text-muted-foreground underline underline-offset-4" onClick={() => setReplacing(false)}>
          Keep the uploaded file
        </button>
      )}
    </div>
  );
}
