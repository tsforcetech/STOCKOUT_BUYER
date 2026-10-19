import * as React from "react";
import { ArrowClockwiseIcon, FileTextIcon, ImagesIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatBytes } from "@/lib/utils/format";
import { newId } from "@/lib/utils/id";
import { filesService } from "@/services/files.service";
import { LISTING_MEDIA_FILE_PURPOSE, LISTING_MEDIA_LIMITS as M, type ListingMediaType } from "@/api/types/seller-listings";
import { DropZone } from "../bulk/drop-zone";
import { FilePicker } from "../components/file-picker";
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
        <DropZone
          id="listing-photos"
          label="Add photos"
          hint={`Drag photos here or choose them. JPG, PNG or WebP · up to ${formatBytes(M.IMAGE_MAX_BYTES)} each · ${Math.max(0, imageSlots)} slot${imageSlots === 1 ? "" : "s"} left`}
          accept={M.IMAGE_MIME_TYPES.join(",")}
          multiple
          disabled={disabled || imageSlots <= 0}
          icon={ImagesIcon}
          buttonLabel="Choose photos"
          onFiles={(files) => enqueue(files, "IMAGE", null)}
        />
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground ring-1 ring-border" aria-hidden>
              <FileTextIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Add a document</p>
              <p className="text-xs text-muted-foreground">Spec sheet, certificate, invoice… PDF, JPG or PNG · up to {formatBytes(M.DOCUMENT_MAX_BYTES)}</p>
            </div>
          </div>
          <FormField label="File" htmlFor="listingDocFile">
            <FilePicker
              ref={docInput}
              file={docFile}
              accept={M.DOCUMENT_MIME_TYPES.join(",")}
              disabled={disabled || documentSlots <= 0}
              placeholder={documentSlots <= 0 ? "Document limit reached" : "Choose a document"}
              onChange={setDocFile}
            />
          </FormField>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormField label="Document type (optional)" htmlFor="listingDocType" className="min-w-0 flex-1">
              <Input placeholder="e.g. Spec sheet" value={docType} maxLength={M.DOCUMENT_TYPE_MAX_LENGTH} disabled={disabled} onChange={(e) => setDocType(e.target.value)} />
            </FormField>
            <Button
              variant="secondary"
              disabled={disabled || !docFile || documentSlots <= 0}
              onClick={() => {
                if (!docFile) return;
                enqueue([docFile], "DOCUMENT", docType.trim() || null);
                setDocFile(null);
                setDocType("");
                if (docInput.current) docInput.current.value = "";
              }}
            >
              <UploadSimpleIcon /> Upload
            </Button>
          </div>
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
