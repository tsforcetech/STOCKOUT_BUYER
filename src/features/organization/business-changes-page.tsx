import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileArrowUpIcon, PaperPlaneTiltIcon, PlusIcon, WarningIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { DetailList } from "@/components/common/page-header";
import { RefreshButton, SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatDate, formatDateTime, humanize } from "@/lib/utils/format";
import { FILE_LIMITS, filesService } from "@/services/files.service";
import { organizationsService } from "@/services/organizations.service";
import { ORG_PERMS, type BusinessChangeCategory, type BusinessChangeRequestResponse } from "@/api/types/organizations";
import { useActiveSeller } from "@/features/seller/lib/queries";
import { FilePicker } from "@/features/seller/components/file-picker";
import { Notice } from "@/features/seller/components/notice";
import { orgErrorMessage } from "./messages";
import { formatGst, orgKeys, useOrgPermissions } from "./queries";

/**
 * PA-1B.2 material business changes: report changes to licence, VAT, bank, signatory, ownership or company details.
 * Deadlines and overdue status come from the server's UAE business calendar and are shown as returned (GST).
 * Field keys match what the approval procedure applies (034 migration, PR_ORGANIZATION_BUSINESS_CHANGE_*).
 */
const CATEGORIES: Array<{ value: BusinessChangeCategory; label: string; fields: Array<{ key: string; label: string; type?: string }> }> = [
  {
    value: "TRADE_LICENCE",
    label: "Trade licence",
    fields: [
      { key: "tradeLicenseNumber", label: "Trade licence no." },
      { key: "issuingAuthority", label: "Issuing authority" },
      { key: "tradeLicenseIssuedAtUtc", label: "Issued on", type: "date" },
      { key: "tradeLicenseExpiresAtUtc", label: "Expires on", type: "date" },
    ],
  },
  {
    value: "VAT_TRN",
    label: "VAT registration / TRN",
    fields: [
      { key: "isVatRegistered", label: "VAT registered", type: "bool" },
      { key: "taxRegistrationNumber", label: "TRN (15 digits)" },
      { key: "hasVatDeclaration", label: "Non-registration declaration confirmed", type: "bool" },
    ],
  },
  {
    value: "BANK_ACCOUNT",
    label: "Bank account",
    fields: [
      { key: "bankBeneficiaryName", label: "Beneficiary name" },
      { key: "bankName", label: "Bank" },
      { key: "bankIban", label: "IBAN" },
      { key: "bankSwiftCode", label: "SWIFT / BIC" },
      { key: "bankAccountNumber", label: "Account number" },
    ],
  },
  {
    value: "AUTHORISED_SIGNATORY",
    label: "Authorised signatory",
    fields: [
      { key: "signatoryName", label: "Full name" },
      { key: "signatoryAuthorityRole", label: "Role" },
      { key: "signatoryEmail", label: "Email", type: "email" },
      { key: "signatoryPhone", label: "Phone", type: "tel" },
    ],
  },
  {
    value: "LEGAL_OWNERSHIP",
    label: "Legal name / ownership",
    fields: [
      { key: "legalName", label: "Legal name" },
      { key: "displayName", label: "Display name" },
      { key: "registrationNo", label: "Registration no." },
    ],
  },
  {
    value: "REGISTERED_COMPANY_DETAILS",
    label: "Address & contact details",
    fields: [
      { key: "addressLine1", label: "Address line 1" },
      { key: "addressLine2", label: "Address line 2" },
      { key: "city", label: "City" },
      { key: "stateOrEmirate", label: "Emirate" },
      { key: "postalCode", label: "PO Box / postal code" },
      { key: "businessContactEmail", label: "Contact email", type: "email" },
      { key: "businessContactPhone", label: "Contact phone", type: "tel" },
    ],
  },
];
const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? humanize(v);

export default function BusinessChangesPage() {
  const orgId = useActiveSeller().sellerId;
  const perms = useOrgPermissions(orgId);
  const changes = useQuery({ queryKey: orgKeys.changes(orgId), queryFn: ({ signal }) => organizationsService.businessChanges(orgId, signal) });
  const [creating, setCreating] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const canSubmit = perms.has(ORG_PERMS.CHANGES_SUBMIT);
  const list = [...(changes.data ?? [])].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Business changes"
        description="Report changes to your licence, VAT, bank, signatory or company details."
        actions={
          <>
            <RefreshButton onClick={() => void changes.refetch()} spinning={changes.isFetching} />
            {canSubmit && (
              <Button variant="action" onClick={() => setCreating(true)}>
                <PlusIcon /> Report a change
              </Button>
            )}
          </>
        }
      />
      <Notice tone="warning" className="mb-4" title="Report changes within 4 UAE business days">
        Material changes to your legal details, licence, TRN, bank account or signatory must be reported within 4 UAE business days of taking effect. The deadline
        is calculated by StockOut from the official UAE calendar and shown in UAE time (GST).
      </Notice>
      <SectionCard>
        {changes.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : changes.error ? (
          <ErrorState error={changes.error} onRetry={() => void changes.refetch()} title="Couldn't load change requests" />
        ) : !list.length ? (
          <EmptyState title="No change requests" description="Nothing has been reported for this company yet." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Change requests">
            {list.map((c) => (
              <li key={c.requestId}>
                <button type="button" onClick={() => setOpenId(c.requestId)} className="flex w-full cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{categoryLabel(c.changeCategory)}</p>
                      <StatusBadge value={c.status} />
                      {c.isOverdue && <Badge tone="danger">Overdue</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Effective {formatDate(c.effectiveDate)} · Report by {formatGst(c.reportingDeadlineUtc)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Created {formatDate(c.createdAtUtc)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <CreateChangeDialog orgId={orgId} open={creating} onOpenChange={setCreating} onCreated={(id) => setOpenId(id)} />
      <ChangeDetailDialog orgId={orgId} requestId={openId} canSubmit={canSubmit} onClose={() => setOpenId(null)} />
    </>
  );
}

function CreateChangeDialog({ orgId, open, onOpenChange, onCreated }: { orgId: string; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = React.useState<BusinessChangeCategory>("TRADE_LICENCE");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [reason, setReason] = React.useState("");
  const [effective, setEffective] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setCategory("TRADE_LICENCE");
      setValues({});
      setReason("");
      setEffective("");
      setError(null);
    }
  }, [open]);
  const def = CATEGORIES.find((c) => c.value === category)!;
  const create = useApiMutation({
    toastOnError: false,
    mutationFn: () => {
      const proposed = Object.fromEntries(
        def.fields
          .map((f) => [f.key, (values[f.key] ?? "").trim()] as const)
          .filter(([, v]) => v)
          .map(([k, v]) => [k, /At(Utc)?$/.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v]),
      );
      return organizationsService.createBusinessChange(orgId, { changeCategory: category, reason: reason.trim(), effectiveDate: `${effective}T00:00:00Z`, proposedValues: proposed });
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: orgKeys.changes(orgId) });
      toast.success("Draft saved. Attach supporting documents, then submit.");
      onOpenChange(false);
      onCreated(created.requestId);
    },
  });
  const submit = () => {
    setError(null);
    if (!effective) return setError("Enter the date the change took effect.");
    if (reason.trim().length < 5) return setError("Explain what changed and why.");
    if (!def.fields.some((f) => (values[f.key] ?? "").trim())) return setError("Fill in at least one new value.");
    create.mutate(undefined, { onError: (e) => setError(orgErrorMessage(e)) });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent
        size="lg"
        title="Report a business change"
        description="Saved as a draft first, so you can attach evidence before submitting."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              Save draft
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="What changed" htmlFor="change-category" required>
              <NativeSelect id="change-category" value={category} onChange={(e) => setCategory(e.target.value as BusinessChangeCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Effective date" htmlFor="change-effective" required hint="The deadline is counted from this date.">
              <Input id="change-effective" type="date" max={new Date().toISOString().slice(0, 10)} value={effective} onChange={(e) => setEffective(e.target.value)} />
            </FormField>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">New values</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {def.fields.map((f) => (
                <FormField key={f.key} label={f.label} htmlFor={`pv-${f.key}`}>
                  {f.type === "bool" ? (
                    <NativeSelect id={`pv-${f.key}`} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                      <option value="">No change</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </NativeSelect>
                  ) : (
                    <Input id={`pv-${f.key}`} type={f.type ?? "text"} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                  )}
                </FormField>
              ))}
            </div>
          </fieldset>
          <FormField label="Reason" htmlFor="change-reason" required>
            <Textarea id="change-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangeDetailDialog({ orgId, requestId, canSubmit, onClose }: { orgId: string; requestId: string | null; canSubmit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: orgKeys.change(orgId, requestId ?? ""),
    queryFn: ({ signal }) => organizationsService.businessChange(orgId, requestId as string, signal),
    enabled: !!requestId,
  });
  const [file, setFile] = React.useState<File | null>(null);
  const [docType, setDocType] = React.useState("SUPPORTING_DOCUMENT");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setFile(null);
    setError(null);
  }, [requestId]);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: orgKeys.change(orgId, requestId ?? "") }), qc.invalidateQueries({ queryKey: orgKeys.changes(orgId) })]);
  const attach = useApiMutation({
    toastOnError: false,
    mutationFn: async () => {
      const asset = await filesService.upload(file!, "SELLER_DOCUMENT");
      await organizationsService.addBusinessChangeDocument(orgId, requestId!, {
        documentType: docType,
        mediaAssetId: asset.fileId,
        fileName: file!.name,
        fileSize: file!.size,
        mimeType: file!.type || "application/octet-stream",
      });
    },
    successMessage: "Document attached.",
    onSuccess: () => {
      setFile(null);
      void refresh();
    },
  });
  const submit = useApiMutation({
    toastOnError: false,
    mutationFn: () => organizationsService.submitBusinessChange(orgId, requestId!),
    onSuccess: (r) => {
      toast[r.isOverdue ? "warning" : "success"](r.isOverdue ? "Submitted — after the reporting deadline, so it's marked overdue." : "Submitted for review.");
      void refresh();
    },
  });
  const c: BusinessChangeRequestResponse | undefined = detail.data;
  const draft = c?.status.toUpperCase() === "DRAFT";
  const fmt = (v: unknown) =>
    v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== null && x !== "").map(([k, x]) => `${humanize(k)}: ${String(x)}`).join(" · ") || "—" : "—";
  return (
    <Dialog open={!!requestId} onOpenChange={(o) => !o && onClose()}>
      {requestId && (
        <DialogContent
          size="lg"
          title={c ? categoryLabel(c.changeCategory) : "Change request"}
          description={c ? `Created ${formatDateTime(c.createdAtUtc)}` : undefined}
          footer={
            <>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              {draft && canSubmit && (
                <Button onClick={() => submit.mutate(undefined, { onError: (e) => setError(orgErrorMessage(e)) })} loading={submit.isPending}>
                  <PaperPlaneTiltIcon /> Submit for review
                </Button>
              )}
            </>
          }
        >
          {detail.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : detail.error || !c ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : (
            <div className="space-y-5">
              <FormError message={error} />
              {c.isOverdue && (
                <Notice tone="danger" title="Past the reporting deadline">
                  This change was due by {formatGst(c.reportingDeadlineUtc)}.
                </Notice>
              )}
              <DetailList
                items={[
                  { label: "Status", value: <StatusBadge value={c.status} /> },
                  { label: "Effective date", value: formatDate(c.effectiveDate) },
                  { label: "Report by", value: formatGst(c.reportingDeadlineUtc) },
                  { label: "Submitted", value: c.submittedAtUtc ? formatGst(c.submittedAtUtc) : "Not yet" },
                  { label: "Previous values", value: fmt(c.previousValues), full: true },
                  { label: "New values", value: fmt(c.proposedValues), full: true },
                  { label: "Reason", value: c.reason, full: true },
                  ...(c.reviewNotes ? [{ label: "Reviewer notes", value: c.reviewNotes, full: true }] : []),
                ]}
              />
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Supporting documents</h3>
                {c.documents?.length ? (
                  <ul className="mb-3 space-y-1 text-sm">
                    {c.documents.map((d) => (
                      <li key={d.documentId} className="text-body">
                        {d.fileName} <span className="text-xs text-muted-foreground">· {humanize(d.documentType)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-3 text-sm text-muted-foreground">None attached.</p>
                )}
                {draft && canSubmit && (
                  <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
                    <FilePicker file={file} accept={FILE_LIMITS.SELLER_DOCUMENT.accept} placeholder="Choose a PDF or image" onChange={setFile} />
                    <NativeSelect aria-label="Document type" value={docType} onChange={(e) => setDocType(e.target.value)}>
                      <option value="SUPPORTING_DOCUMENT">Supporting document</option>
                      <option value="TRADE_LICENSE">Trade licence</option>
                      <option value="VAT_CERTIFICATE">VAT certificate</option>
                      <option value="BANK_LETTER">Bank letter</option>
                      <option value="POWER_OF_ATTORNEY">Power of attorney</option>
                      <option value="MEMORANDUM_OF_ASSOCIATION">MOA</option>
                    </NativeSelect>
                    <Button variant="secondary" disabled={!file} loading={attach.isPending} onClick={() => attach.mutate(undefined, { onError: (e) => setError(orgErrorMessage(e)) })}>
                      <FileArrowUpIcon /> Attach
                    </Button>
                  </div>
                )}
              </section>
              {!!c.history?.length && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">History</h3>
                  <ul className="space-y-1 text-sm">
                    {c.history.map((h) => (
                      <li key={h.historyId} className="text-body">
                        {humanize(h.fromStatus)} → {humanize(h.toStatus)} <span className="text-xs text-muted-foreground">· {formatGst(h.occurredAtUtc)}</span>
                        {h.notes ? ` — ${h.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {draft && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> Approved changes to licence, VAT, bank, signatory or ownership send your company back for KYC re-check.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
