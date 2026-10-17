import * as React from "react";
import { ArrowClockwiseIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatBytes } from "@/lib/utils/format";
import { newId } from "@/lib/utils/id";
import { filesService } from "@/services/files.service";
import { LISTING_MEDIA_FILE_PURPOSE, LISTING_MEDIA_LIMITS as M, type ListingMediaType } from "@/api/types/seller-listings";
import { UploadProgress } from "../components/upload-progress";
import { sellerErrorMessage } from "../lib/errors";

interface UploadItem {
  id: string;
  file: File;
  mediaType: ListingMediaType;
  documentType: string | null;
  progress: number;
  fileId: string | null;
  status: "uploading" | "attaching" | "failed";
  error?: string;
}

interface Props {
  disabled: boolean;
  /** Attaches an uploaded file to the draft (uses the latest listing rowVersion). */
  attach: (fileId: string, mediaType: ListingMediaType, documentType: string | null) => Promise<void>;
  imageSlots: number;
  documentSlots: number;
}

function check(file: File, mediaType: ListingMediaType): string | null {
  const types: readonly string[] = mediaType === "IMAGE" ? M.IMAGE_MIME_TYPES : M.DOCUMENT_MIME_TYPES;
  const max = mediaType === "IMAGE" ? M.IMAGE_MAX_BYTES : M.DOCUMENT_MAX_BYTES;
  if (!types.includes(file.type)) return mediaType === "IMAGE" ? "Use JPG, PNG or WebP images." : "Use PDF, JPG or PNG documents.";
  if (file.size > max) return `Files must be ${formatBytes(max)} or smaller.`;
  return null;
}

/** Upload (files service) → attach (listing media). Failed attaches keep the uploaded file id for retry. */
export function MediaUploader({ disabled, attach, imageSlots, documentSlots }: Props) {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [docType, setDocType] = React.useState("");
  const [docFile, setDocFile] = React.useState<File | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const docInput = React.useRef<HTMLInputElement>(null);

  const patch = (id: string, p: Partial<UploadItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const run = useApiMutation({
    toastOnError: false,
    mutationFn: async (item: UploadItem) => {
      let fileId = item.fileId;
      if (!fileId) {
        patch(item.id, { status: "uploading", error: undefined });
        const asset = await filesService.upload(item.file, LISTING_MEDIA_FILE_PURPOSE[item.mediaType], { onProgress: (p) => patch(item.id, { progress: p }) });
        fileId = asset.fileId;
        patch(item.id, { fileId, progress: 1 });
      }
      patch(item.id, { status: "attaching", error: undefined });
      await attach(fileId, item.mediaType, item.documentType);
    },
  });

  const process = async (queue: UploadItem[]) => {
    for (const item of queue) {
      try {
        await run.mutateAsync(item);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } catch (error) {
        patch(item.id, { status: "failed", error: sellerErrorMessage(error) });
      }
    }
  };

  const enqueue = (files: File[], mediaType: ListingMediaType, documentType: string | null) => {
    setLocalError(null);
    const slots = mediaType === "IMAGE" ? imageSlots : documentSlots;
    if (files.length > slots) {
      setLocalError(slots <= 0 ? `This listing already has the maximum number of ${mediaType === "IMAGE" ? "images" : "documents"}.` : `You can add ${slots} more ${mediaType === "IMAGE" ? "image" : "document"}${slots === 1 ? "" : "s"}.`);
      return;
    }
    const bad = files.map((f) => check(f, mediaType)).find(Boolean);
    if (bad) {
      setLocalError(bad);
      return;
    }
    const queue = files.map<UploadItem>((file) => ({ id: newId(), file, mediaType, documentType, progress: 0, fileId: null, status: "uploading" }));
    setItems((prev) => [...prev, ...queue]);
    void process(queue);
  };

  const busy = items.some((i) => i.status !== "failed");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-dashed border-secondary-border p-4">
          <p className="font-medium text-foreground">Add photos</p>
          <p className="mb-3 text-xs text-muted-foreground">JPG, PNG or WebP · up to {formatBytes(M.IMAGE_MAX_BYTES)} each · {Math.max(0, imageSlots)} slot{imageSlots === 1 ? "" : "s"} left</p>
          <Button asChild variant="secondary" size="sm" className={disabled || imageSlots <= 0 ? "pointer-events-none opacity-50" : undefined}>
            <label>
              <UploadSimpleIcon /> Choose images
              <input
                type="file"
                className="sr-only"
                multiple
                accept={M.IMAGE_MIME_TYPES.join(",")}
                disabled={disabled || imageSlots <= 0}
                onChange={(e) => {
                  enqueue(Array.from(e.target.files ?? []), "IMAGE", null);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
        <div className="space-y-3 rounded-lg border border-dashed border-secondary-border p-4">
          <div>
            <p className="font-medium text-foreground">Add a document</p>
            <p className="text-xs text-muted-foreground">Spec sheet, certificate, invoice… PDF, JPG or PNG · up to {formatBytes(M.DOCUMENT_MAX_BYTES)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Document type" htmlFor="listingDocType" hint="Optional, e.g. Spec sheet">
              <Input value={docType} maxLength={M.DOCUMENT_TYPE_MAX_LENGTH} disabled={disabled} onChange={(e) => setDocType(e.target.value)} />
            </FormField>
            <FormField label="File" htmlFor="listingDocFile">
              <Input ref={docInput} type="file" accept={M.DOCUMENT_MIME_TYPES.join(",")} disabled={disabled || documentSlots <= 0} onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </FormField>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled || !docFile || documentSlots <= 0}
            onClick={() => {
              if (!docFile) return;
              enqueue([docFile], "DOCUMENT", docType.trim() || null);
              setDocFile(null);
              setDocType("");
              if (docInput.current) docInput.current.value = "";
            }}
          >
            <UploadSimpleIcon /> Upload document
          </Button>
        </div>
      </div>
      {localError && (
        <p role="alert" className="text-sm text-danger-soft-foreground">
          {localError}
        </p>
      )}
      {items.length > 0 && (
        <ul className="space-y-2" aria-label="Uploads">
          {items.map((i) => (
            <li key={i.id} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{i.file.name}</span>
                {i.status === "failed" && (
                  <span className="flex shrink-0 gap-1">
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => void process([{ ...i, status: "uploading" }])}>
                      <ArrowClockwiseIcon /> Retry
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}>
                      <XIcon />
                    </Button>
                  </span>
                )}
              </div>
              {i.status === "failed" ? (
                <p className="text-xs text-danger-soft-foreground" role="alert">
                  {i.error}
                  {i.fileId ? " The file is uploaded — retry to attach it." : ""}
                </p>
              ) : (
                <UploadProgress value={i.progress} label={i.status === "attaching" ? "Attaching to listing…" : "Uploading…"} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
