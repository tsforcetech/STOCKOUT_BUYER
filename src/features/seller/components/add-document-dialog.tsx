import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { FormError, FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { FILE_LIMITS, filesService } from "@/services/files.service";
import { marketplaceService } from "@/services/marketplace.service";
import { formatBytes } from "@/lib/utils/format";
import { isApiError } from "@/lib/api/errors";
import { dateInputToUtcIso } from "../lib/listing";
import { sellerAccountErrorMessage, sellerErrorMessage } from "../lib/errors";
import { sellerKeys } from "../lib/queries";
import {
  BANK_TYPES,
  COMBINED_TYPES,
  OTHER_TYPES,
  SIGNATORY_AUTHORITY_TYPES,
  SIGNATORY_COMBINED_TYPES,
  SIGNATORY_ID_TYPES,
  TRADE_LICENSE_TYPES,
  VAT_DECLARATION_TYPES,
  VAT_REGISTERED_TYPES,
  type DocTypeOption,
  type KycCategory,
} from "../lib/kyc";
import { cn } from "@/lib/utils/cn";
import { FilePicker } from "./file-picker";
import { UploadProgress } from "./upload-progress";

const LIMIT = FILE_LIMITS.SELLER_DOCUMENT;
const ACCEPTED = LIMIT.accept.split(",");

export type UploadCategory = KycCategory | "OTHER";

const CATEGORIES: Array<{ value: UploadCategory; label: string }> = [
  { value: "TRADE_LICENSE", label: "Trade licence" },
  { value: "VAT", label: "VAT" },
  { value: "SIGNATORY", label: "Signatory" },
  { value: "BANK", label: "Bank letter" },
  { value: "OTHER", label: "Other" },
];

/** Document types offered per category; VAT depends on the profile's VAT status (PA-1B.1-R4). */
function typeGroups(category: UploadCategory, vatRegistered: boolean): Array<{ label?: string; options: DocTypeOption[] }> {
  switch (category) {
    case "TRADE_LICENSE":
      return [{ options: TRADE_LICENSE_TYPES }];
    case "VAT":
      return [{ options: vatRegistered ? VAT_REGISTERED_TYPES : VAT_DECLARATION_TYPES }];
    case "SIGNATORY":
      return [
        { label: "Identity", options: SIGNATORY_ID_TYPES },
        { label: "Authority to act for the company", options: SIGNATORY_AUTHORITY_TYPES },
        { label: "Both in one file", options: SIGNATORY_COMBINED_TYPES },
      ];
    case "BANK":
      return [{ options: BANK_TYPES }];
    default:
      return [{ options: OTHER_TYPES }];
  }
}

const today = () => new Date().toISOString().slice(0, 10);

const schema = z
  .object({
    category: z.enum(["TRADE_LICENSE", "VAT", "SIGNATORY", "BANK", "OTHER"]),
    documentType: z.string().trim().min(1, "Choose the document type."),
    documentNumber: z.string().trim().max(100, "Use 100 characters or fewer."),
    issuedAt: z.string(),
    expiresAt: z.string(),
    containsId: z.boolean(),
    containsAuthority: z.boolean(),
    file: z
      .custom<File | null>((v) => v === null || v instanceof File)
      .refine((f) => f instanceof File, "Choose a file to upload.")
      .refine((f) => !(f instanceof File) || ACCEPTED.includes(f.type), "Upload a PDF, JPG or PNG file.")
      .refine((f) => !(f instanceof File) || f.size <= LIMIT.maxBytes, `The file must be ${formatBytes(LIMIT.maxBytes)} or smaller.`),
  })
  .refine((v) => v.category !== "TRADE_LICENSE" || !!v.expiresAt, { path: ["expiresAt"], message: "Enter the licence expiry date." })
  .refine((v) => !v.issuedAt || !v.expiresAt || v.expiresAt >= v.issuedAt, { path: ["expiresAt"], message: "Expiry must be on or after the issue date." })
  .refine((v) => !v.expiresAt || v.expiresAt >= today(), { path: ["expiresAt"], message: "This document has expired. Upload a current one." })
  .refine((v) => !COMBINED_TYPES.has(v.documentType) || v.containsId || v.containsAuthority, { path: ["containsId"], message: "Tick what this file contains." });

type FormValues = z.input<typeof schema>;
type Values = z.output<typeof schema>;
const empty = (category: UploadCategory): FormValues => ({ category, documentType: "", documentNumber: "", issuedAt: "", expiresAt: "", containsId: false, containsAuthority: false, file: null });

export function AddDocumentDialog({
  sellerId,
  open,
  onOpenChange,
  vatRegistered = false,
  initialCategory = "TRADE_LICENSE",
}: {
  sellerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** From the business profile: decides which VAT document types are accepted. */
  vatRegistered?: boolean;
  initialCategory?: UploadCategory;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  // Keeps an uploaded file so a failed "add document" call can be retried without uploading again.
  const uploaded = React.useRef<{ file: File; fileId: string } | null>(null);
  const form = useForm<FormValues, unknown, Values>({ resolver: zodResolver(schema), defaultValues: empty(initialCategory) });
  const errors = form.formState.errors;

  React.useEffect(() => {
    if (open) {
      form.reset(empty(initialCategory));
      setFormError(null);
      setProgress(null);
      uploaded.current = null;
    }
  }, [open, form, initialCategory]);

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
        ...(COMBINED_TYPES.has(v.documentType) ? { containsSignatoryId: v.containsId, containsSignatoryAuthorityProof: v.containsAuthority } : {}),
      });
    },
    // The seller record holds the server's missing-categories list and completeness flag, so it must reload too.
    invalidate: [sellerKeys.documents(sellerId), sellerKeys.seller(sellerId), sellerKeys.eligibility(sellerId)],
    successMessage: "Document added.",
    onSuccess: () => onOpenChange(false),
  });

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await add.mutateAsync(v);
    } catch (error) {
      setProgress(null);
      // inventory-media errors use catalog-style codes; user-organization ones are mapped by sellerAccountErrorMessage.
      if (isApiError(error) && error.code && /^(FILE_|STORAGE_)/.test(error.code) && error.code !== "FILE_NOT_AVAILABLE") setFormError(sellerErrorMessage(error));
      else setFormError(sellerAccountErrorMessage(error));
    }
  });

  const busy = form.formState.isSubmitting;
  const file = form.watch("file");
  const category = form.watch("category");
  const documentType = form.watch("documentType");
  const containsId = form.watch("containsId");
  const containsAuthority = form.watch("containsAuthority");
  const groups = typeGroups(category, vatRegistered);

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
          <fieldset>
            <legend className="mb-2 text-sm text-body">
              Requirement <span className="text-danger" aria-hidden>*</span>
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Requirement">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={category === c.value}
                  onClick={() => {
                    form.setValue("category", c.value);
                    form.setValue("documentType", "");
                  }}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    category === c.value ? "border-action-border bg-action-soft font-medium text-foreground" : "border-border bg-surface text-body hover:bg-surface-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          <FormField
            label="Document type"
            htmlFor="documentType"
            required
            error={errors.documentType?.message}
            hint={category === "VAT" ? (vatRegistered ? "Your business profile says you're VAT registered." : "Your business profile says you're not VAT registered — upload the signed declaration.") : undefined}
          >
            <NativeSelect {...form.register("documentType")}>
              <option value="">Choose…</option>
              {groups.map((g) =>
                g.label ? (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))
                ),
              )}
            </NativeSelect>
          </FormField>
          {COMBINED_TYPES.has(documentType) && (
            <fieldset className="space-y-2 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm text-body">
                This file contains <span className="text-danger" aria-hidden>*</span>
              </legend>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <Checkbox className="mt-0.5" checked={containsId} onCheckedChange={(v) => form.setValue("containsId", v === true, { shouldValidate: true })} />
                The signatory's Emirates ID or passport
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                <Checkbox className="mt-0.5" checked={containsAuthority} onCheckedChange={(v) => form.setValue("containsAuthority", v === true, { shouldValidate: true })} />
                Proof of authority (power of attorney, MOA or board resolution)
              </label>
              {errors.containsId?.message && <p className="text-sm text-danger">{errors.containsId.message}</p>}
            </fieldset>
          )}
          <FormField label="File" htmlFor="documentFile" required error={errors.file?.message} hint={`PDF, JPG or PNG, max ${formatBytes(LIMIT.maxBytes)}.`}>
            <FilePicker
              file={file ?? null}
              accept={LIMIT.accept}
              disabled={busy}
              placeholder="Choose a scan or photo"
              onChange={(f) => form.setValue("file", f, { shouldValidate: true })}
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
            <FormField label="Expires on" htmlFor="expiresAt" required={category === "TRADE_LICENSE"} error={errors.expiresAt?.message}>
              <Input type="date" min={today()} {...form.register("expiresAt")} />
            </FormField>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
