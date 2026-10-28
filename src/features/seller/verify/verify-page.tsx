import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { useForm, useWatch, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, CheckIcon, PaperPlaneTiltIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { FormError, FormField } from "@/components/forms/form-field";
import { isApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import { marketplaceService } from "@/services/marketplace.service";
import type { MarketplaceSellerDto, SellerDocumentResponse, UpdateSellerProfileRequest } from "@/api/types/user-organization";
import { usePolicyGate } from "@/features/legal/policy-gate";
import { useSellerDocuments } from "../components/documents-table";
import { Notice } from "../components/notice";
import { dateInputToUtcIso, isoToDateInput } from "../lib/listing";
import { kycBlockerHints, kycTypeLabel, licenceProblem } from "../lib/kyc";
import { sellerAccountErrorMessage } from "../lib/errors";
import { sellerKeys, useActiveSeller, useSellerAccount } from "../lib/queries";
import { EMIRATES, ISSUING_AUTHORITIES, STEPS, docsFor, firstOpenStep, newest, signatoryDocs, stepDone, type StepKey } from "./steps";
import { FileSlot, checkFile, uploadDocument } from "./file-slot";

/**
 * /seller/verify — business verification as five short steps (company, VAT, signatory, bank, submit), each document
 * uploaded next to its details. Every step saves to the server (the profile endpoint keeps fields that aren't sent),
 * so a seller can stop and resume at the first unfinished step.
 */
export default function SellerVerifyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link to="/" aria-label="StockOut home">
          <Logo />
        </Link>
        <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-foreground">Seller</span>
        <Link to="/" className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline">
          Save and exit
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <VerifyContent />
      </main>
    </div>
  );
}

function VerifyContent() {
  const context = useActiveSeller();
  const sellerId = context.sellerId;
  const account = useSellerAccount(sellerId);
  const docs = useSellerDocuments(sellerId);
  const [params, setParams] = useSearchParams();
  const seller = account.data;

  const header = <PageHeader title="Verify your business" description="Five short steps, about 10 minutes. Your progress is saved after each one." />;
  if (account.isLoading || docs.isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (!seller || account.error) {
    return (
      <div className="space-y-4">
        {header}
        <Notice tone="danger" title="Your business details couldn't be loaded" action={<Button size="sm" variant="secondary" onClick={() => void account.refetch()}>Try again</Button>}>
          {sellerAccountErrorMessage(account.error)}
        </Notice>
      </div>
    );
  }
  if (!(context.isOwner && context.status === "ACTIVE")) {
    return (
      <div className="space-y-4">
        {header}
        <Notice tone="warning">Only the owner of an active seller account can complete verification.</Notice>
      </div>
    );
  }
  const editable = seller.onboardingStatus === "DRAFT" || seller.verificationStatus === "REJECTED";
  if (!editable) {
    return (
      <div className="space-y-4">
        {header}
        <SectionCard className="text-center">
          <CheckCircleIcon className="mx-auto size-12 text-success" weight="fill" aria-hidden />
          <h2 className="mt-3 font-heading text-xl font-bold text-foreground">
            {seller.verificationStatus === "VERIFIED" ? "Your business is verified" : "Submitted — we're reviewing your business"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {seller.verificationStatus === "VERIFIED" ? "You can list stock on StockOut." : "We'll let you know once it's checked. You can follow the status on the Business page."}
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link to="/seller/business">Go to Business & verification</Link>
          </Button>
        </SectionCard>
      </div>
    );
  }

  const requested = params.get("step") as StepKey | null;
  const current: StepKey = requested && STEPS.some((s) => s.key === requested) ? requested : firstOpenStep(seller);
  const go = (key: StepKey) => {
    setParams({ step: key }, { replace: false });
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const index = STEPS.findIndex((s) => s.key === current);
  const next = () => go(STEPS[Math.min(index + 1, STEPS.length - 1)].key);
  const back = index > 0 ? () => go(STEPS[index - 1].key) : undefined;
  const list = docs.data ?? [];
  const props = { seller, docs: list, onDone: next, onBack: back };

  return (
    <div className="space-y-4">
      {header}
      {seller.verificationStatus === "REJECTED" && (
        <Notice tone="warning" title="Our team asked for changes">
          {seller.rejectionReason || "Please check your details and documents."} Fix the steps below, then submit again. Rejected documents need a new upload.
        </Notice>
      )}
      <StepNav current={current} seller={seller} onGo={go} />
      <SectionCard>
        {current === "company" && <CompanyStep {...props} />}
        {current === "vat" && <VatStep {...props} />}
        {current === "signatory" && <SignatoryStep {...props} />}
        {current === "bank" && <BankStep {...props} />}
        {current === "review" && <ReviewStep seller={seller} docs={list} onGo={go} />}
      </SectionCard>
    </div>
  );
}

function StepNav({ current, seller, onGo }: { current: StepKey; seller: MarketplaceSellerDto; onGo: (k: StepKey) => void }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto rounded-xl bg-surface p-2 sm:gap-2 sm:p-3" aria-label="Verification steps">
      {STEPS.map((s, i) => {
        const done = s.key !== "review" && stepDone(s.key, seller);
        const active = s.key === current;
        return (
          <li key={s.key} className={cn("flex items-center gap-1 sm:min-w-0 sm:flex-1 sm:gap-2", active ? "flex-none" : "min-w-0 flex-1")}>
            <button
              type="button"
              onClick={() => onGo(s.key)}
              aria-current={active ? "step" : undefined}
              className={cn("flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", active ? "bg-surface-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  done ? "border-action-border bg-action text-action-foreground" : active ? "border-ink bg-ink text-ink-foreground" : "border-secondary-border",
                )}
                aria-hidden
              >
                {done ? <CheckIcon weight="bold" className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("truncate", !active && "hidden sm:inline")}>{s.short}</span>
              <span className="sr-only">{done ? " (done)" : ""}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------------------------------------- shared helpers */

interface StepProps {
  seller: MarketplaceSellerDto;
  docs: SellerDocumentResponse[];
  onDone: () => void;
  onBack?: () => void;
}

const FIELD_FOR_CODE: Record<string, string> = {
  SELLER_IBAN_INVALID: "bankIban",
  SELLER_TRN_INVALID: "taxRegistrationNumber",
  SELLER_LICENCE_EXPIRED: "tradeLicenseExpiresAtUtc",
  DUPLICATE_TRADE_LICENSE: "tradeLicenseNumber",
};
const today = () => new Date().toISOString().slice(0, 10);
const text = (max: number, required?: string) => (required ? z.string().trim().min(1, required).max(max, `Use ${max} characters or fewer.`) : z.string().trim().max(max, `Use ${max} characters or fewer.`));
const email = (required?: string) =>
  required ? z.string().trim().min(1, required).email("Enter a valid email address.") : z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]);

/**
 * Saves a step: the profile fields first (the server keeps everything not sent), then any new documents.
 * Reloads the seller record afterwards, since it carries the server's completeness.
 */
function useStepSave(sellerId: string) {
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const run = async <T extends FieldValues>(form: UseFormReturn<T>, profile: Omit<UpdateSellerProfileRequest, "expectedRowVersion"> | null, uploads: () => Promise<void>): Promise<boolean> => {
    setError(null);
    setSaving(true);
    try {
      if (profile) {
        const fresh = await qc.fetchQuery({ queryKey: sellerKeys.seller(sellerId), queryFn: ({ signal }) => marketplaceService.seller(sellerId, signal), staleTime: 0 });
        const updated = await marketplaceService.updateSellerProfile(sellerId, { ...profile, expectedRowVersion: fresh.rowVersion });
        qc.setQueryData(sellerKeys.seller(sellerId), updated);
      }
      await uploads();
      return true;
    } catch (e) {
      const field = isApiError(e) && e.code ? FIELD_FOR_CODE[e.code] : undefined;
      if (field && field in form.getValues()) form.setError(field as Path<T>, { message: sellerAccountErrorMessage(e) });
      else setError(sellerAccountErrorMessage(e, "Your details changed in another window. Reload the page and try again."));
      return false;
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: sellerKeys.seller(sellerId) }),
        qc.invalidateQueries({ queryKey: sellerKeys.documents(sellerId) }),
        qc.invalidateQueries({ queryKey: sellerKeys.eligibility(sellerId) }),
      ]);
      setSaving(false);
    }
  };
  return { run, error, saving };
}

function StepFooter({ onBack, saving, label = "Save and continue" }: { onBack?: () => void; saving: boolean; label?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
          <ArrowLeftIcon /> Back
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" loading={saving}>
        {label} <ArrowRightIcon />
      </Button>
    </div>
  );
}

function StepTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="font-heading text-xl font-bold text-foreground">{title}</h2>
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** A file is required only when nothing usable is on file yet. */
function fileError(file: File | null, existing: SellerDocumentResponse | undefined, missingMessage: string): string | null {
  if (file) return checkFile(file);
  return existing ? null : missingMessage;
}

/* --------------------------------------------------------------------------------------------- 1. company */

const companySchema = z
  .object({
    legalName: text(200, "Enter the company's legal name as on the trade licence."),
    tradeLicenseNumber: text(100, "Enter the trade licence number."),
    issuingAuthority: text(150, "Enter who issued the licence."),
    tradeLicenseIssuedAtUtc: z.string(),
    tradeLicenseExpiresAtUtc: z.string().min(1, "Enter the licence expiry date."),
    stateOrEmirate: z.string().min(1, "Choose the emirate."),
    city: text(100),
    addressLine1: text(200, "Enter the business address."),
    businessContactPhone: text(50),
  })
  .refine((v) => v.tradeLicenseExpiresAtUtc > today(), { path: ["tradeLicenseExpiresAtUtc"], message: "This licence has expired. Use your current licence." })
  .refine((v) => !v.tradeLicenseIssuedAtUtc || v.tradeLicenseIssuedAtUtc <= v.tradeLicenseExpiresAtUtc, { path: ["tradeLicenseIssuedAtUtc"], message: "Issue date must be before expiry." });

function CompanyStep({ seller, docs, onDone, onBack }: StepProps) {
  const existing = newest(docsFor(docs, "TRADE_LICENSE"));
  const form = useForm<z.input<typeof companySchema>, unknown, z.output<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      legalName: seller.legalName ?? "",
      tradeLicenseNumber: seller.tradeLicenseNumber ?? seller.registrationNo ?? existing?.documentNumber ?? "",
      issuingAuthority: seller.issuingAuthority ?? "",
      tradeLicenseIssuedAtUtc: isoToDateInput(seller.tradeLicenseIssuedAtUtc ?? existing?.issuedAt),
      tradeLicenseExpiresAtUtc: isoToDateInput(seller.tradeLicenseExpiresAtUtc ?? existing?.expiresAt),
      stateOrEmirate: seller.stateOrEmirate ?? "",
      city: seller.city ?? "",
      addressLine1: seller.addressLine1 ?? "",
      businessContactPhone: seller.businessContactPhone ?? "",
    },
  });
  const [file, setFile] = React.useState<File | null>(null);
  const [fileErr, setFileErr] = React.useState<string | null>(null);
  const save = useStepSave(seller.sellerId);
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const fe = fileError(file, existing, "Upload your trade licence.");
    setFileErr(fe);
    if (fe) return;
    const ok = await save.run(
      form,
      {
        legalName: v.legalName,
        tradeLicenseNumber: v.tradeLicenseNumber,
        issuingAuthority: v.issuingAuthority,
        tradeLicenseIssuedAtUtc: dateInputToUtcIso(v.tradeLicenseIssuedAtUtc),
        tradeLicenseExpiresAtUtc: dateInputToUtcIso(v.tradeLicenseExpiresAtUtc),
        stateOrEmirate: v.stateOrEmirate,
        city: v.city,
        addressLine1: v.addressLine1,
        businessContactPhone: v.businessContactPhone,
      },
      async () => {
        if (file)
          await uploadDocument(seller.sellerId, file, {
            documentType: "TRADE_LICENSE",
            documentNumber: v.tradeLicenseNumber,
            issuedAt: dateInputToUtcIso(v.tradeLicenseIssuedAtUtc),
            expiresAt: dateInputToUtcIso(v.tradeLicenseExpiresAtUtc),
          });
      },
    );
    if (ok) onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepTitle title="Company and trade licence">Enter the details exactly as they appear on your trade licence, then upload it.</StepTitle>
      <FormError message={save.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Legal company name" htmlFor="legalName" required error={e.legalName?.message} className="sm:col-span-2">
          <Input id="legalName" autoComplete="organization" {...form.register("legalName")} />
        </FormField>
        <FormField label="Trade licence number" htmlFor="tradeLicenseNumber" required error={e.tradeLicenseNumber?.message}>
          <Input id="tradeLicenseNumber" {...form.register("tradeLicenseNumber")} />
        </FormField>
        <FormField label="Issued by" htmlFor="issuingAuthority" required hint="Start typing, e.g. Dubai DET, DMCC, JAFZA." error={e.issuingAuthority?.message}>
          <Input id="issuingAuthority" list="issuing-authorities" {...form.register("issuingAuthority")} />
        </FormField>
        <datalist id="issuing-authorities">
          {ISSUING_AUTHORITIES.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <FormField label="Issue date" htmlFor="tradeLicenseIssuedAtUtc" error={e.tradeLicenseIssuedAtUtc?.message}>
          <Input id="tradeLicenseIssuedAtUtc" type="date" {...form.register("tradeLicenseIssuedAtUtc")} />
        </FormField>
        <FormField label="Expiry date" htmlFor="tradeLicenseExpiresAtUtc" required error={e.tradeLicenseExpiresAtUtc?.message}>
          <Input id="tradeLicenseExpiresAtUtc" type="date" {...form.register("tradeLicenseExpiresAtUtc")} />
        </FormField>
        <FormField label="Emirate" htmlFor="stateOrEmirate" required error={e.stateOrEmirate?.message}>
          <NativeSelect id="stateOrEmirate" {...form.register("stateOrEmirate")}>
            <option value="">Choose…</option>
            {EMIRATES.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="City / area" htmlFor="city" error={e.city?.message}>
          <Input id="city" placeholder="e.g. Al Quoz" {...form.register("city")} />
        </FormField>
        <FormField label="Business address" htmlFor="addressLine1" required error={e.addressLine1?.message} className="sm:col-span-2">
          <Input id="addressLine1" autoComplete="street-address" placeholder="Building, street, office / warehouse no." {...form.register("addressLine1")} />
        </FormField>
        <FormField label="Business phone" htmlFor="businessContactPhone" error={e.businessContactPhone?.message}>
          <Input id="businessContactPhone" type="tel" placeholder="+971 4 123 4567" {...form.register("businessContactPhone")} />
        </FormField>
        <div className="sm:col-span-2">
          <FileSlot id="tradeLicenceFile" label="Trade licence (required)" existing={existing} file={file} onFile={(f) => (setFile(f), setFileErr(null))} error={fileErr} disabled={save.saving} />
        </div>
      </div>
      <StepFooter onBack={onBack} saving={save.saving} />
    </form>
  );
}

/* --------------------------------------------------------------------------------------------- 2. VAT */

const vatSchema = z
  .object({ registered: z.enum(["yes", "no"]), taxRegistrationNumber: z.string().trim(), declaration: z.boolean() })
  .refine((v) => v.registered === "no" || /^\d{15}$/.test(v.taxRegistrationNumber.replace(/\s+/g, "")), { path: ["taxRegistrationNumber"], message: "Enter the 15-digit TRN." })
  .refine((v) => v.registered === "yes" || v.declaration, { path: ["declaration"], message: "Tick to confirm the business isn't VAT registered." });

const VAT_CERT = ["VAT_CERTIFICATE", "VAT_REGISTRATION_CERTIFICATE", "TAX_REGISTRATION_CERTIFICATE", "TRN_CERTIFICATE"];

function VatStep({ seller, docs, onDone, onBack }: StepProps) {
  const form = useForm<z.input<typeof vatSchema>, unknown, z.output<typeof vatSchema>>({
    resolver: zodResolver(vatSchema),
    defaultValues: { registered: seller.isVatRegistered ? "yes" : "no", taxRegistrationNumber: seller.taxRegistrationNumber ?? "", declaration: !!seller.hasVatDeclaration },
  });
  const registered = useWatch({ control: form.control, name: "registered" }) === "yes";
  const declared = !!useWatch({ control: form.control, name: "declaration" });
  const vatDocs = docsFor(docs, "VAT");
  const existing = newest(vatDocs.filter((d) => VAT_CERT.includes(d.documentType.toUpperCase()) === registered));
  const [file, setFile] = React.useState<File | null>(null);
  const [fileErr, setFileErr] = React.useState<string | null>(null);
  const save = useStepSave(seller.sellerId);
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const yes = v.registered === "yes";
    const fe = fileError(file, existing, yes ? "Upload your VAT / TRN certificate." : "Upload the signed VAT non-registration declaration.");
    setFileErr(fe);
    if (fe) return;
    const ok = await save.run(
      form,
      { isVatRegistered: yes, taxRegistrationNumber: yes ? v.taxRegistrationNumber.replace(/\s+/g, "") : "", hasVatDeclaration: !yes && v.declaration },
      async () => {
        if (file) await uploadDocument(seller.sellerId, file, { documentType: yes ? "VAT_REGISTRATION_CERTIFICATE" : "VAT_NON_REGISTRATION_DECLARATION" });
      },
    );
    if (ok) onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepTitle title="VAT">Is the business registered for VAT with the Federal Tax Authority?</StepTitle>
      <FormError message={save.error} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">VAT registered</legend>
        {(
          [
            ["yes", "Yes, we're VAT registered", "We'll ask for the TRN and VAT certificate."],
            ["no", "No, not VAT registered", "We'll ask for a signed declaration."],
          ] as const
        ).map(([value, title, desc]) => (
          <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-ink has-[:checked]:bg-surface-muted">
            <input type="radio" value={value} className="mt-1 accent-[var(--ink)]" {...form.register("registered")} onChange={(ev) => (form.setValue("registered", ev.target.value as "yes" | "no"), setFile(null), setFileErr(null))} />
            <span>
              <span className="block text-sm font-medium text-foreground">{title}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-4 space-y-4">
        {registered ? (
          <FormField label="TRN (Tax Registration Number)" htmlFor="taxRegistrationNumber" required hint="15 digits." error={e.taxRegistrationNumber?.message}>
            <Input id="taxRegistrationNumber" inputMode="numeric" {...form.register("taxRegistrationNumber")} />
          </FormField>
        ) : (
          <div>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox className="mt-0.5" checked={declared} onCheckedChange={(c) => form.setValue("declaration", c === true, { shouldValidate: form.formState.isSubmitted })} aria-label="I confirm the business is not registered for VAT" />
              <span>I confirm the business is not registered for VAT in the UAE.</span>
            </label>
            {e.declaration && <p className="mt-1 text-xs text-danger">{e.declaration.message}</p>}
          </div>
        )}
        <FileSlot
          id="vatFile"
          label={registered ? "VAT / TRN certificate (required)" : "Signed VAT non-registration declaration (required)"}
          hint={registered ? undefined : "A short letter on company letterhead, signed and stamped, stating the business isn't VAT registered."}
          existing={existing}
          file={file}
          onFile={(f) => (setFile(f), setFileErr(null))}
          error={fileErr}
          disabled={save.saving}
        />
      </div>
      <StepFooter onBack={onBack} saving={save.saving} />
    </form>
  );
}

/* --------------------------------------------------------------------------------------------- 3. signatory */

const AUTHORITY_TYPES = [
  { value: "SIGNATORY_POA", label: "Power of attorney" },
  { value: "BOARD_RESOLUTION", label: "Board resolution" },
  { value: "MEMORANDUM_OF_ASSOCIATION", label: "Memorandum of association (MOA)" },
  { value: "ARTICLES_OF_ASSOCIATION", label: "Articles of association" },
];

const signatorySchema = z.object({
  signatoryName: text(200, "Enter the signatory's full name."),
  signatoryAuthorityRole: text(100, "Enter their role, e.g. Owner or Manager."),
  signatoryEmail: email("Enter the signatory's email."),
  signatoryPhone: text(50, "Enter the signatory's mobile number."),
  idType: z.enum(["SIGNATORY_EMIRATES_ID", "SIGNATORY_PASSPORT"]),
  onLicence: z.enum(["yes", "no"]),
  authorityType: z.string(),
});

function SignatoryStep({ seller, docs, onDone, onBack }: StepProps) {
  const licence = newest(docsFor(docs, "TRADE_LICENSE"));
  const idDoc = newest(signatoryDocs(docs, "id"));
  const authorityDocs = signatoryDocs(docs, "authority");
  const ownAuthority = newest(authorityDocs.filter((d) => d.documentType.toUpperCase() !== "TRADE_LICENSE_SIGNATORY_PROOF"));
  const form = useForm<z.input<typeof signatorySchema>, unknown, z.output<typeof signatorySchema>>({
    resolver: zodResolver(signatorySchema),
    defaultValues: {
      signatoryName: seller.signatoryName ?? "",
      signatoryAuthorityRole: seller.signatoryAuthorityRole ?? "",
      signatoryEmail: seller.signatoryEmail ?? "",
      signatoryPhone: seller.signatoryPhone ?? "",
      idType: idDoc?.documentType.toUpperCase() === "SIGNATORY_PASSPORT" ? "SIGNATORY_PASSPORT" : "SIGNATORY_EMIRATES_ID",
      // Most UAE sellers are owner-managed: the signatory is on the licence, so no extra document is needed.
      onLicence: ownAuthority ? "no" : "yes",
      authorityType: "SIGNATORY_POA",
    },
  });
  const onLicence = useWatch({ control: form.control, name: "onLicence" }) === "yes";
  const [idFile, setIdFile] = React.useState<File | null>(null);
  const [authFile, setAuthFile] = React.useState<File | null>(null);
  const [errs, setErrs] = React.useState<{ id?: string | null; auth?: string | null; licence?: string | null }>({});
  const save = useStepSave(seller.sellerId);
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const next = {
      id: fileError(idFile, idDoc, "Upload the signatory's Emirates ID or passport."),
      auth: v.onLicence === "no" ? fileError(authFile, ownAuthority, "Upload the power of attorney or board resolution.") : null,
      licence: v.onLicence === "yes" && !licence ? "Upload the trade licence in step 1 first." : null,
    };
    setErrs(next);
    if (next.id || next.auth || next.licence) return;
    const ok = await save.run(
      form,
      { signatoryName: v.signatoryName, signatoryAuthorityRole: v.signatoryAuthorityRole, signatoryEmail: v.signatoryEmail, signatoryPhone: v.signatoryPhone },
      async () => {
        if (idFile) await uploadDocument(seller.sellerId, idFile, { documentType: v.idType });
        if (v.onLicence === "no" && authFile) await uploadDocument(seller.sellerId, authFile, { documentType: v.authorityType });
        // Signatory named on the licence: the licence already on file is recorded as the authority proof (the reviewer confirms it).
        if (v.onLicence === "yes" && licence && !authorityDocs.length)
          await marketplaceService.addDocument(seller.sellerId, {
            documentType: "TRADE_LICENSE_SIGNATORY_PROOF",
            fileAssetId: licence.fileAssetId,
            documentNumber: licence.documentNumber,
            expiresAt: licence.expiresAt,
          });
      },
    );
    if (ok) onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepTitle title="Authorised signatory">The person who can sign for the company, usually the owner or manager.</StepTitle>
      <FormError message={save.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="signatoryName" required error={e.signatoryName?.message}>
          <Input id="signatoryName" autoComplete="name" {...form.register("signatoryName")} />
        </FormField>
        <FormField label="Role" htmlFor="signatoryAuthorityRole" required error={e.signatoryAuthorityRole?.message}>
          <Input id="signatoryAuthorityRole" list="signatory-roles" placeholder="Owner, Manager, Partner…" {...form.register("signatoryAuthorityRole")} />
        </FormField>
        <datalist id="signatory-roles">
          {["Owner", "Manager", "Partner", "Director", "General Manager"].map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <FormField label="Email" htmlFor="signatoryEmail" required error={e.signatoryEmail?.message}>
          <Input id="signatoryEmail" type="email" {...form.register("signatoryEmail")} />
        </FormField>
        <FormField label="Mobile" htmlFor="signatoryPhone" required error={e.signatoryPhone?.message}>
          <Input id="signatoryPhone" type="tel" placeholder="+971 50 123 4567" {...form.register("signatoryPhone")} />
        </FormField>
        <FormField label="ID document" htmlFor="idType">
          <NativeSelect id="idType" {...form.register("idType")}>
            <option value="SIGNATORY_EMIRATES_ID">Emirates ID</option>
            <option value="SIGNATORY_PASSPORT">Passport</option>
          </NativeSelect>
        </FormField>
        <div className="sm:col-span-2">
          <FileSlot id="idFile" label="Emirates ID or passport (required)" hint="Both sides of the Emirates ID in one file." existing={idDoc} file={idFile} onFile={(f) => (setIdFile(f), setErrs((x) => ({ ...x, id: null })))} error={errs.id} disabled={save.saving} />
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-foreground">Is this person named on the trade licence (as owner, partner or manager)?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["yes", "Yes", "No extra document needed: the trade licence shows they can act for the company."],
              ["no", "No", "Upload a power of attorney or board resolution."],
            ] as const
          ).map(([value, title, desc]) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-ink has-[:checked]:bg-surface-muted">
              <input type="radio" value={value} className="mt-1 accent-[var(--ink)]" {...form.register("onLicence")} />
              <span>
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {errs.licence && <p className="mt-1 text-xs text-danger">{errs.licence}</p>}
      </fieldset>

      {!onLicence && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField label="Document type" htmlFor="authorityType">
            <NativeSelect id="authorityType" {...form.register("authorityType")}>
              {AUTHORITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="sm:col-span-2">
            <FileSlot id="authorityFile" label="Proof of authority (required)" existing={ownAuthority} file={authFile} onFile={(f) => (setAuthFile(f), setErrs((x) => ({ ...x, auth: null })))} error={errs.auth} disabled={save.saving} />
          </div>
        </div>
      )}
      <StepFooter onBack={onBack} saving={save.saving} />
    </form>
  );
}

/* --------------------------------------------------------------------------------------------- 4. bank */

const bankSchema = z.object({
  bankName: text(150, "Enter the bank name."),
  bankBeneficiaryName: text(200, "Enter the account holder name."),
  bankIban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => /^AE[0-9A-Z]{21}$/.test(v), "Enter a UAE IBAN: AE followed by 21 characters."),
  bankSwiftCode: text(11),
  letterType: z.enum(["BANK_IBAN_LETTER", "IBAN_CERTIFICATE"]),
});

function BankStep({ seller, docs, onDone, onBack }: StepProps) {
  const existing = newest(docsFor(docs, "BANK"));
  const form = useForm<z.input<typeof bankSchema>, unknown, z.output<typeof bankSchema>>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      bankName: seller.bankName ?? "",
      bankBeneficiaryName: seller.bankBeneficiaryName ?? seller.legalName ?? "",
      bankIban: seller.bankIban ?? "",
      bankSwiftCode: seller.bankSwiftCode ?? "",
      letterType: "BANK_IBAN_LETTER",
    },
  });
  const [file, setFile] = React.useState<File | null>(null);
  const [fileErr, setFileErr] = React.useState<string | null>(null);
  const save = useStepSave(seller.sellerId);
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const fe = fileError(file, existing, "Upload a bank letter or IBAN certificate.");
    setFileErr(fe);
    if (fe) return;
    const ok = await save.run(form, { bankName: v.bankName, bankBeneficiaryName: v.bankBeneficiaryName, bankIban: v.bankIban, bankSwiftCode: v.bankSwiftCode }, async () => {
      if (file) await uploadDocument(seller.sellerId, file, { documentType: v.letterType });
    });
    if (ok) onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepTitle title="Bank account">Where we pay your sales. The account must be in the company's name.</StepTitle>
      <FormError message={save.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Bank name" htmlFor="bankName" required error={e.bankName?.message}>
          <Input id="bankName" placeholder="e.g. Emirates NBD" {...form.register("bankName")} />
        </FormField>
        <FormField label="Account holder name" htmlFor="bankBeneficiaryName" required error={e.bankBeneficiaryName?.message}>
          <Input id="bankBeneficiaryName" {...form.register("bankBeneficiaryName")} />
        </FormField>
        <FormField label="IBAN" htmlFor="bankIban" required hint="AE followed by 21 characters." error={e.bankIban?.message}>
          <Input id="bankIban" autoComplete="off" placeholder="AE07 0331 2345 6789 0123 456" {...form.register("bankIban")} />
        </FormField>
        <FormField label="SWIFT code" htmlFor="bankSwiftCode" error={e.bankSwiftCode?.message}>
          <Input id="bankSwiftCode" autoComplete="off" {...form.register("bankSwiftCode")} />
        </FormField>
        <FormField label="Document type" htmlFor="letterType">
          <NativeSelect id="letterType" {...form.register("letterType")}>
            <option value="BANK_IBAN_LETTER">Bank letter with IBAN</option>
            <option value="IBAN_CERTIFICATE">IBAN certificate</option>
          </NativeSelect>
        </FormField>
        <div className="sm:col-span-2">
          <FileSlot id="bankFile" label="Bank letter or IBAN certificate (required)" existing={existing} file={file} onFile={(f) => (setFile(f), setFileErr(null))} error={fileErr} disabled={save.saving} />
        </div>
      </div>
      <StepFooter onBack={onBack} saving={save.saving} />
    </form>
  );
}

/* --------------------------------------------------------------------------------------------- 5. review */

function ReviewStep({ seller, docs, onGo }: { seller: MarketplaceSellerDto; docs: SellerDocumentResponse[]; onGo: (k: StepKey) => void }) {
  const qc = useQueryClient();
  const { reloadActor } = useAuth();
  const { recheck } = usePolicyGate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [agreed, setAgreed] = React.useState(false);
  const steps = STEPS.filter((s) => s.key !== "review");
  const open = steps.filter((s) => !stepDone(s.key, seller));
  const licence = licenceProblem(seller);
  const hints = seller.mandatoryDocumentsComplete ? [] : kycBlockerHints(seller, docs);
  const ready = open.length === 0 && !licence && seller.mandatoryDocumentsComplete !== false;

  const summary: Record<Exclude<StepKey, "review">, string> = {
    company: [seller.legalName, seller.tradeLicenseNumber && `Licence ${seller.tradeLicenseNumber}`, seller.tradeLicenseExpiresAtUtc && `expires ${formatDate(seller.tradeLicenseExpiresAtUtc)}`, seller.stateOrEmirate].filter(Boolean).join(" · "),
    vat: seller.isVatRegistered ? `VAT registered · TRN ${seller.taxRegistrationNumber ?? "—"}` : seller.hasVatDeclaration ? "Not VAT registered (declaration)" : "Not answered yet",
    signatory: [seller.signatoryName, seller.signatoryAuthorityRole].filter(Boolean).join(" · ") || "Not answered yet",
    bank: [seller.bankName, seller.bankIban && `IBAN ••••${seller.bankIban.slice(-4)}`].filter(Boolean).join(" · ") || "Not answered yet",
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const fresh = await qc.fetchQuery({ queryKey: sellerKeys.seller(seller.sellerId), queryFn: ({ signal }) => marketplaceService.seller(seller.sellerId, signal), staleTime: 0 });
      const updated = await marketplaceService.submitSeller(seller.sellerId, fresh.rowVersion);
      qc.setQueryData(sellerKeys.seller(seller.sellerId), updated);
      toast.success("Submitted for review. We'll let you know once it's checked.");
      await reloadActor();
    } catch (e) {
      if (isApiError(e) && e.code === "POLICY_ACCEPTANCE_REQUIRED") void recheck();
      setError(sellerAccountErrorMessage(e, "Your details changed since this page loaded. We refreshed them; please check and submit again."));
      void qc.invalidateQueries({ queryKey: sellerKeys.seller(seller.sellerId) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <StepTitle title="Review and submit">Check your details. Our team reviews them, usually within 1–2 working days.</StepTitle>
      <FormError message={error} />
      <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Summary">
        {steps.map((s) => {
          const done = stepDone(s.key, seller);
          return (
            <li key={s.key} className="flex items-center gap-3 p-3 sm:p-4">
              {done ? <CheckCircleIcon className="size-6 shrink-0 text-success" weight="fill" aria-hidden /> : <WarningCircleIcon className="size-6 shrink-0 text-warning" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{done ? summary[s.key as Exclude<StepKey, "review">] : "Not finished"}</p>
              </div>
              <Button size="sm" variant={done ? "ghost" : "action"} onClick={() => onGo(s.key)}>
                {done ? "Edit" : "Finish"}
              </Button>
            </li>
          );
        })}
      </ul>
      {(licence || hints.length > 0) && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {[licence, ...hints].filter(Boolean).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Documents on file: {liveCount(docs)}. {docs.some((d) => d.documentType.toUpperCase() === "TRADE_LICENSE_SIGNATORY_PROOF") ? `${kycTypeLabel("TRADE_LICENSE_SIGNATORY_PROOF")} is used as the signatory's authority.` : ""}
      </p>
      {ready && (
        <label className="mt-4 flex items-start gap-2 text-sm text-foreground">
          <Checkbox className="mt-0.5" checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} aria-label="I confirm these details are correct" />
          <span>I confirm the details and documents are correct and belong to this business.</span>
        </label>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="ghost" onClick={() => onGo("bank")} disabled={busy}>
          <ArrowLeftIcon /> Back
        </Button>
        <Button onClick={() => void submit()} disabled={!ready || !agreed} loading={busy}>
          <PaperPlaneTiltIcon /> Submit for review
        </Button>
      </div>
    </div>
  );
}

const liveCount = (docs: SellerDocumentResponse[]) => docs.filter((d) => d.verificationStatus !== "REJECTED").length;
