import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { FILE_LIMITS, filesService } from "@/services/files.service";
import { marketplaceService } from "@/services/marketplace.service";
import { formatBytes } from "@/lib/utils/format";
import { isApiError } from "@/lib/api/errors";
import { dateInputToUtcIso } from "../lib/listing";
import { sellerAccountErrorMessage, sellerErrorMessage } from "../lib/errors";
import { sellerKeys } from "../lib/queries";
import { UploadProgress } from "./upload-progress";

const SUGGESTIONS = ["Trade licence", "Emirates ID", "Passport", "VAT certificate", "Certificate of incorporation", "Memorandum of association", "Bank letter", "Power of attorney"];
const LIMIT = FILE_LIMITS.SELLER_DOCUMENT;
const ACCEPTED = LIMIT.accept.split(",");

const schema = z
  .object({
    documentType: z.string().trim().min(1, "Choose or type a document type.").max(100, "Use 100 characters or fewer."),
    documentNumber: z.string().trim().max(100, "Use 100 characters or fewer."),
    issuedAt: z.string(),
    expiresAt: z.string(),
    file: z
      .custom<File | null>((v) => v === null || v instanceof File)
      .refine((f) => f instanceof File, "Choose a file to upload.")
      .refine((f) => !(f instanceof File) || ACCEPTED.includes(f.type), "Upload a PDF, JPG or PNG file.")
      .refine((f) => !(f instanceof File) || f.size <= LIMIT.maxBytes, `The file must be ${formatBytes(LIMIT.maxBytes)} or smaller.`),
  })
  .refine((v) => !v.issuedAt || !v.expiresAt || v.expiresAt >= v.issuedAt, { path: ["expiresAt"], message: "Expiry must be on or after the issue date." });

type FormValues = z.input<typeof schema>;
type Values = z.output<typeof schema>;
const EMPTY: FormValues = { documentType: "", documentNumber: "", issuedAt: "", expiresAt: "", file: null };

export function AddDocumentDialog({ sellerId, open, onOpenChange }: { sellerId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  // Keeps an uploaded file so a failed "add document" call can be retried without uploading again.
  const uploaded = React.useRef<{ file: File; fileId: string } | null>(null);
  const form = useForm<FormValues, unknown, Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const errors = form.formState.errors;

  React.useEffect(() => {
    if (open) {
      form.reset(EMPTY);
      setFormError(null);
      setProgress(null);
      uploaded.current = null;
    }
  }, [open, form]);

  const add = useApiMutation({
    toastOnError: false,
    mutationFn: async (v: Values) => {
      const file = v.file;
      let fileId = uploaded.current?.file === file ? uploaded.current.fileId : null;
      if (!fileId) {
        setProgress(0);
        const asset = await filesService.upload(file, "SELLER_DOCUMENT", { onProgress: setProgress });
        fileId = asset.fileId;
        uploaded.current = { file, fileId };
      }
      setProgress(1);
      return marketplaceService.addDocument(sellerId, {
        documentType: v.documentType,
        fileAssetId: fileId,
        documentNumber: v.documentNumber || null,
        issuedAt: dateInputToUtcIso(v.issuedAt),
        expiresAt: dateInputToUtcIso(v.expiresAt),
      });
    },
    invalidate: [sellerKeys.documents(sellerId)],
    successMessage: "Document added.",
    onSuccess: () => onOpenChange(false),
  });

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await add.mutateAsync(v);
    } catch (error) {
      setProgress(null);
      // Files errors carry a code ({ errorCode }); user-organization errors don't (E2).
      if (isApiError(error) && error.code) setFormError(sellerErrorMessage(error));
      else if (isApiError(error) && error.status === 400 && !error.hasFieldErrors)
        // The only non-field 400 for this endpoint is MARKETPLACE_SELLER_DOCUMENT_FILE_INVALID: the server's check of the
        // uploaded file failed. A backend defect currently makes that check fail for every file (see STOCKOUT_BACKEND_ISSUES A0).
        setFormError("Your file uploaded, but the server couldn't verify it, so the document wasn't saved. This is a known server issue that's being fixed — please try again later or contact support.");
      else setFormError(sellerAccountErrorMessage(error));
    }
  });

  const busy = form.formState.isSubmitting;
  const file = form.watch("file");

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        title="Add verification document"
        description="Upload a clear scan or photo. PDF, JPG or PNG up to 20 MB."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="add-document-form" loading={busy}>
              Upload & add
            </Button>
          </>
        }
      >
        <form id="add-document-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          <FormField label="Document type" htmlFor="documentType" required error={errors.documentType?.message} hint="Pick a suggestion or type your own.">
            <Input list="document-type-suggestions" maxLength={100} {...form.register("documentType")} />
          </FormField>
          <datalist id="document-type-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <FormField label="File" htmlFor="documentFile" required error={errors.file?.message} hint={file ? `${file.name} · ${formatBytes(file.size)}` : "PDF, JPG or PNG, max 20 MB."}>
            <Input
              type="file"
              accept={LIMIT.accept}
              disabled={busy}
              onChange={(e) => form.setValue("file", e.target.files?.[0] ?? null, { shouldValidate: true })}
            />
          </FormField>
          {progress !== null && <UploadProgress value={progress} label={progress >= 1 ? "Uploaded — saving document…" : "Uploading…"} />}
          <FormField label="Document number" htmlFor="documentNumber" error={errors.documentNumber?.message}>
            <Input maxLength={100} {...form.register("documentNumber")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Issued on" htmlFor="issuedAt" error={errors.issuedAt?.message}>
              <Input type="date" {...form.register("issuedAt")} />
            </FormField>
            <FormField label="Expires on" htmlFor="expiresAt" error={errors.expiresAt?.message}>
              <Input type="date" {...form.register("expiresAt")} />
            </FormField>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
