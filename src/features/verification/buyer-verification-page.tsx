import * as React from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, ClockIcon, FileArrowUpIcon, IdentificationCardIcon, ProhibitIcon, ShieldCheckIcon, TrashIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { FormField } from "@/components/forms/form-field";
import { ErrorState } from "@/components/feedback/states";
import { Notice } from "@/features/seller/components/notice";
import { AccountTabs } from "@/features/account/account-tabs";
import { usePolicyGate } from "@/features/legal/policy-gate";
import { buyerEligibilityKey, useBuyerEligibility } from "@/features/cart/components/buyer-eligibility";
import { useAuth } from "@/lib/auth/auth-context";
import { isApiError } from "@/lib/api/errors";
import { marketplaceService } from "@/services/marketplace.service";
import { FILE_LIMITS, filesService } from "@/services/files.service";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { BuyerDocumentResponse, BuyerProfileDto, UpsertBuyerProfileRequest } from "@/api/types/user-organization";
import { ISO_COUNTRIES } from "./countries";
import { verificationMessage } from "./verification-messages";

/**
 * Buyer identity verification (handoff 2026-11-06, Q1–Q15): one government-issued ID for the registered account holder,
 * uploaded privately, reviewed by a StockOut admin. Nothing here marks a buyer verified: status, canPurchase and the
 * review outcome always come from the API.
 */

export const verificationKeys = {
  profile: ["buyer", "profile"] as const,
  documents: ["buyer", "identity-documents"] as const,
};

const ID_TYPES = [
  { value: "EMIRATES_ID", label: "Emirates ID" },
  { value: "PASSPORT", label: "Passport" },
  { value: "NATIONAL_ID", label: "National ID (other country)" },
];
const ID_TYPE_SET = new Set(["EMIRATES_ID", "PASSPORT", "NATIONAL_ID", "GOVERNMENT_ID", "OTHER_GOVERNMENT_ID", "EID", "NATIONAL_IDENTITY"]);
const isIdDoc = (d: BuyerDocumentResponse) => ID_TYPE_SET.has(d.documentType.toUpperCase());
const idLabel = (t: string | null | undefined) => ID_TYPES.find((x) => x.value === t?.toUpperCase())?.label ?? (t ? t.replace(/_/g, " ").toLowerCase() : "—");

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();
const COUNTRY_OPTIONS = ISO_COUNTRIES.map(([a2, a3]) => ({ value: a3, alpha2: a2, label: regionNames?.of(a2) ?? a2 })).sort((a, b) => a.label.localeCompare(b.label));
const toAlpha3 = (code: string | null | undefined) => {
  if (!code) return "";
  const c = code.trim().toUpperCase();
  return ISO_COUNTRIES.find(([a2, a3]) => a2 === c || a3 === c)?.[1] ?? c;
};
const countryName = (code: string | null | undefined) => {
  const a3 = toAlpha3(code);
  return COUNTRY_OPTIONS.find((o) => o.value === a3)?.label ?? code ?? "—";
};

function useBuyerProfileQuery() {
  const { status } = useAuth();
  return useQuery({
    queryKey: verificationKeys.profile,
    queryFn: async ({ signal }) => {
      try {
        return await marketplaceService.buyerProfile(signal);
      } catch (e) {
        if (isApiError(e) && e.code === "MARKETPLACE_BUYER_NOT_FOUND") return null; // not started yet
        throw e;
      }
    },
    enabled: status === "authenticated",
    staleTime: 0,
  });
}

type Phase = "none" | "draft" | "reverify" | "review" | "rejected" | "verified" | "suspended";
function phaseOf(p: BuyerProfileDto | null): Phase {
  if (!p) return "none";
  if (p.orgStatus === "SUSPENDED") return "suspended";
  if (p.requiresReverification && !["SUBMITTED", "UNDER_REVIEW"].includes(p.verificationStatus)) return "reverify";
  switch (p.verificationStatus) {
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "review";
    case "REJECTED":
      return "rejected";
    case "VERIFIED":
      return "verified";
    default:
      return "draft";
  }
}
const editablePhase = (ph: Phase) => ph === "none" || ph === "draft" || ph === "rejected" || ph === "reverify";

export default function BuyerVerificationPage() {
  const profile = useBuyerProfileQuery();
  const p = profile.data ?? null;
  const docs = useQuery({ queryKey: verificationKeys.documents, queryFn: ({ signal }) => marketplaceService.buyerDocuments(signal), enabled: !!p, staleTime: 0 });
  const elig = useBuyerEligibility();

  if (profile.isLoading)
    return (
      <div>
        <AccountTabs />
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  if (profile.error)
    return (
      <div>
        <AccountTabs />
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </div>
    );

  const phase = phaseOf(p);
  const documents = docs.data ?? [];
  return (
    <div>
      <AccountTabs />
      <h1 className="font-heading text-2xl font-bold text-foreground">Identity verification</h1>
      <p className="mt-1 max-w-2xl text-sm text-body">
        To buy on StockOut, verify the identity of the account holder with one government ID: an Emirates ID, a passport or another national ID. A StockOut team member reviews it, usually within 2 business days.
      </p>
      <div className="mt-5 space-y-4">
        <StatusCard phase={phase} p={p} canPurchase={elig.data?.canPurchase === true && elig.data.eligible} eligibilityLoaded={!!elig.data} />
        <DetailsStep p={p} phase={phase} />
        {p && <DocumentStep p={p} phase={phase} documents={documents} loading={docs.isLoading} error={docs.error} onRetry={() => void docs.refetch()} />}
        {p && editablePhase(phase) && <SubmitStep p={p} documents={documents} />}
        <p className="rounded-xl bg-surface p-4 text-xs leading-5 text-muted-foreground">
          Before you're verified you can still browse, save to your wishlist, add to your cart and request quotes. Only purchasing waits for verification. Your ID is stored privately and is only seen by StockOut reviewers.
        </p>
      </div>
    </div>
  );
}

function StatusCard({ phase, p, canPurchase, eligibilityLoaded }: { phase: Phase; p: BuyerProfileDto | null; canPurchase: boolean; eligibilityLoaded: boolean }) {
  const expired = !!p?.documentExpiresAtUtc && new Date(p.documentExpiresAtUtc).getTime() < Date.now();
  const card = (tone: "info" | "warning" | "danger" | "success", Icon: React.ElementType, title: string, body: React.ReactNode) => (
    <section
      aria-label="Verification status"
      className={cn(
        "flex gap-3 rounded-2xl border p-5",
        tone === "success" && "border-success/30 bg-success-soft text-success-soft-foreground",
        tone === "warning" && "border-warning/30 bg-warning-soft text-warning-soft-foreground",
        tone === "danger" && "border-danger/30 bg-danger-soft text-danger-soft-foreground",
        tone === "info" && "border-border bg-surface text-foreground",
      )}
    >
      <Icon className="mt-0.5 size-6 shrink-0" weight={tone === "success" ? "fill" : "regular"} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-heading text-base font-bold">{title}</p>
        <div className="mt-1 leading-relaxed">{body}</div>
      </div>
    </section>
  );
  switch (phase) {
    case "none":
    case "draft":
      return card("info", ShieldCheckIcon, "Complete identity verification", "Add your details, upload one ID and submit it for review. You can't purchase until it's approved.");
    case "reverify":
      return card("warning", WarningCircleIcon, "Verification required again", <>Our verification rules have changed, so a new ID must be submitted before you can purchase.{p?.reverificationReason ? ` ${p.reverificationReason}` : ""}</>);
    case "review":
      return card("info", ClockIcon, "Under review", <>Submitted {formatDateTime(p?.submittedAtUtc)}. We aim to finish within 2 business days. You'll be able to purchase once it's approved.</>);
    case "rejected":
      return card(
        "danger",
        WarningCircleIcon,
        "Verification wasn't approved",
        <>
          {p?.rejectionReason ? <span className="block font-medium">Reason: {p.rejectionReason}</span> : null}
          Update your details if needed, upload a replacement ID and submit again.
        </>,
      );
    case "verified":
      return card(
        expired ? "warning" : "success",
        expired ? WarningCircleIcon : CheckCircleIcon,
        "Verified",
        <>
          Verified {formatDate(p?.verifiedAtUtc)}.{" "}
          {eligibilityLoaded ? (canPurchase ? "Your account can purchase." : "Purchasing is currently unavailable for your account. Contact StockOut support if this is unexpected.") : null}
          {expired && <span className="mt-1 block">Your ID expired on {formatDate(p?.documentExpiresAtUtc)}. You stay verified for now, but please keep your ID up to date; StockOut may ask you to verify again.</span>}
        </>,
      );
    case "suspended":
      return card("danger", ProhibitIcon, "Purchasing is disabled", <>Your buyer account is suspended{p?.suspensionReason ? `: ${p.suspensionReason}` : "."} Contact StockOut support at info@stockoutme.com.</>);
  }
}

function StepShell({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby={`vstep-${n}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold", done ? "bg-success text-white" : "bg-foreground text-surface")}>
          {done ? <CheckCircleIcon className="size-4" weight="bold" aria-hidden /> : n}
        </span>
        <h2 id={`vstep-${n}`} className="font-heading text-lg font-bold text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

type Form = { organizationType: "INDIVIDUAL" | "BUSINESS"; fullName: string; nationality: string; documentType: string; documentNumber: string; issuingCountry: string; documentExpires: string; mobileNumber: string; residentialAddress: string };
const formFrom = (p: BuyerProfileDto | null): Form => ({
  organizationType: p?.organizationType === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL",
  fullName: p?.fullName ?? "",
  nationality: toAlpha3(p?.nationality),
  documentType: p?.documentType?.toUpperCase() ?? "",
  documentNumber: p?.documentNumber ?? "",
  issuingCountry: toAlpha3(p?.issuingCountry),
  documentExpires: p?.documentExpiresAtUtc?.slice(0, 10) ?? "",
  mobileNumber: p?.mobileNumber ?? "",
  residentialAddress: p?.residentialAddress ?? "",
});
const today = () => new Date().toISOString().slice(0, 10);

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.fullName.trim()) e.fullName = "Enter your full name as on your ID.";
  if (!f.nationality) e.nationality = "Choose your nationality.";
  if (!f.documentType) e.documentType = "Choose the ID type.";
  if (!f.documentNumber.trim()) e.documentNumber = "Enter the ID number.";
  if (!f.issuingCountry) e.issuingCountry = "Choose the issuing country.";
  if (!f.documentExpires) e.documentExpires = "Enter the expiry date.";
  else if (f.documentExpires <= today()) e.documentExpires = "This ID has expired. Use a valid ID.";
  if (!f.mobileNumber.trim()) e.mobileNumber = "Enter your mobile number.";
  else if (!/^\+?[0-9 ()-]{7,20}$/.test(f.mobileNumber.trim())) e.mobileNumber = "Enter a valid mobile number, e.g. +971 50 123 4567.";
  if (!f.residentialAddress.trim()) e.residentialAddress = "Enter your residential address.";
  return e;
}

function DetailsStep({ p, phase }: { p: BuyerProfileDto | null; phase: Phase }) {
  const qc = useQueryClient();
  const editable = editablePhase(phase);
  const [editing, setEditing] = React.useState(!p);
  const [form, setForm] = React.useState<Form>(() => formFrom(p));
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!editing) setForm(formFrom(p));
  }, [p, editing]);
  const errors = touched ? validate(form) : {};
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setTouched(true);
    if (Object.keys(validate(form)).length) return;
    setSaving(true);
    setServerError(null);
    try {
      // Always the latest rowVersion; keep any company invoicing details already on the profile.
      const latest = p ? await marketplaceService.buyerProfile() : null;
      const body: UpsertBuyerProfileRequest = {
        ...(latest
          ? {
              legalName: latest.legalName, tradingName: latest.tradingName, tradeLicenseNumber: latest.tradeLicenseNumber, issuingAuthority: latest.issuingAuthority,
              tradeLicenseIssuedAtUtc: latest.tradeLicenseIssuedAtUtc, tradeLicenseExpiresAtUtc: latest.tradeLicenseExpiresAtUtc, isVatRegistered: latest.isVatRegistered,
              taxRegistrationNumber: latest.taxRegistrationNumber, hasVatDeclaration: latest.hasVatDeclaration, businessContactEmail: latest.businessContactEmail,
              businessContactPhone: latest.businessContactPhone, addressLine1: latest.addressLine1, addressLine2: latest.addressLine2, city: latest.city,
              stateOrEmirate: latest.stateOrEmirate, postalCode: latest.postalCode, countryCode: latest.countryCode, defaultCurrency: latest.defaultCurrency,
            }
          : {}),
        organizationType: form.organizationType,
        fullName: form.fullName.trim(),
        nationality: form.nationality,
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        issuingCountry: form.issuingCountry,
        documentExpiresAtUtc: `${form.documentExpires}T00:00:00Z`,
        mobileNumber: form.mobileNumber.trim(),
        residentialAddress: form.residentialAddress.trim(),
        expectedRowVersion: latest?.rowVersion ?? null,
      };
      const saved = await marketplaceService.saveBuyerProfile(body);
      qc.setQueryData(verificationKeys.profile, saved);
      void qc.invalidateQueries({ queryKey: verificationKeys.documents });
      void qc.invalidateQueries({ queryKey: buyerEligibilityKey });
      setEditing(false);
      setTouched(false);
      toast.success("Your details are saved.");
    } catch (e) {
      setServerError(verificationMessage(e));
      if (isApiError(e) && (e.code === "MARKETPLACE_BUYER_VERSION_CONFLICT" || e.code === "INVALID_ROW_VERSION")) void qc.invalidateQueries({ queryKey: verificationKeys.profile });
    } finally {
      setSaving(false);
    }
  };

  const showForm = editable && (editing || !p);
  return (
    <StepShell n={1} title="Your details" done={!!p && !showForm}>
      {showForm ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">I'm buying as</legend>
            <div className="flex flex-wrap gap-2">
              {(["INDIVIDUAL", "BUSINESS"] as const).map((t) => (
                <label key={t} className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm", form.organizationType === t ? "border-foreground font-semibold" : "border-border")}>
                  <input type="radio" name="orgType" className="accent-foreground" checked={form.organizationType === t} onChange={() => set("organizationType", t)} />
                  {t === "INDIVIDUAL" ? "An individual" : "A company"}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Either way, we verify the identity of you, the account holder.</p>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name (as on your ID)" htmlFor="v-name" required error={errors.fullName}>
              <Input autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Nationality" htmlFor="v-nat" required error={errors.nationality}>
              <NativeSelect value={form.nationality} onChange={(e) => set("nationality", e.target.value)}>
                <option value="">Choose…</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="ID type" htmlFor="v-type" required error={errors.documentType}>
              <NativeSelect value={form.documentType} onChange={(e) => set("documentType", e.target.value)}>
                <option value="">Choose…</option>
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="ID number" htmlFor="v-num" required error={errors.documentNumber}>
              <Input value={form.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} maxLength={64} autoComplete="off" />
            </FormField>
            <FormField label="Issuing country" htmlFor="v-issuer" required error={errors.issuingCountry}>
              <NativeSelect value={form.issuingCountry} onChange={(e) => set("issuingCountry", e.target.value)}>
                <option value="">Choose…</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="ID expiry date" htmlFor="v-exp" required error={errors.documentExpires}>
              <Input type="date" min={today()} value={form.documentExpires} onChange={(e) => set("documentExpires", e.target.value)} />
            </FormField>
            <FormField label="Mobile number" htmlFor="v-mobile" required error={errors.mobileNumber}>
              <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+971 50 123 4567" value={form.mobileNumber} onChange={(e) => set("mobileNumber", e.target.value)} maxLength={20} />
            </FormField>
            <FormField label="Residential address" htmlFor="v-addr" required error={errors.residentialAddress} className="sm:col-span-2">
              <Textarea rows={2} autoComplete="street-address" value={form.residentialAddress} onChange={(e) => set("residentialAddress", e.target.value)} maxLength={500} />
            </FormField>
          </div>
          {serverError && <Notice tone="danger">{serverError}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving}>
              Save details
            </Button>
            {p && (
              <Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : p ? (
        <div>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ["Full name", p.fullName],
              ["Buying as", p.organizationType === "BUSINESS" ? "A company" : "An individual"],
              ["Nationality", countryName(p.nationality)],
              ["ID type", idLabel(p.documentType)],
              ["ID number", p.documentNumber],
              ["Issuing country", countryName(p.issuingCountry)],
              ["ID expiry", formatDate(p.documentExpiresAtUtc)],
              ["Mobile", p.mobileNumber],
              ["Residential address", p.residentialAddress],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 break-words text-foreground">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {editable && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          )}
        </div>
      ) : null}
    </StepShell>
  );
}

function DocumentStep({ p, phase, documents, loading, error, onRetry }: { p: BuyerProfileDto; phase: Phase; documents: BuyerDocumentResponse[]; loading: boolean; error: unknown; onRetry: () => void }) {
  const qc = useQueryClient();
  const editable = editablePhase(phase);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);

  const cutoff = p.requiresReverification && p.reverificationRequiredAtUtc ? new Date(p.reverificationRequiredAtUtc).getTime() : null;
  const isStale = (d: BuyerDocumentResponse) => cutoff !== null && new Date(d.createdAtUtc).getTime() < cutoff;
  const active = documents.filter((d) => d.verificationStatus.toUpperCase() !== "REJECTED");
  const current = active.filter((d) => isIdDoc(d) && !isStale(d));
  const stale = active.filter(isStale);
  const history = documents.filter((d) => !active.includes(d));
  const detailsReady = !!(p.documentType && p.documentNumber && p.issuingCountry && p.documentExpiresAtUtc);
  const canUpload = editable && detailsReady && current.length === 0 && stale.length === 0;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: verificationKeys.documents });
    void qc.invalidateQueries({ queryKey: verificationKeys.profile });
  };

  const upload = async (file: File) => {
    setProblem(null);
    setProgress(0);
    try {
      const asset = await filesService.upload(file, "BUYER_DOCUMENT", { onProgress: setProgress });
      await marketplaceService.addBuyerDocument({
        documentType: p.documentType!,
        fileAssetId: asset.fileId,
        documentNumber: p.documentNumber,
        expiresAt: p.documentExpiresAtUtc,
        issuingCountry: p.issuingCountry,
      });
      toast.success("Your ID is uploaded. Submit it for review when you're ready.");
      refresh();
    } catch (e) {
      setProblem(verificationMessage(e));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (d: BuyerDocumentResponse) => {
    setBusyId(d.buyerDocumentId);
    setProblem(null);
    try {
      await marketplaceService.deleteBuyerDocument(d.buyerDocumentId);
      refresh();
    } catch (e) {
      setProblem(verificationMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const row = (d: BuyerDocumentResponse, actions?: React.ReactNode, note?: React.ReactNode) => (
    <li key={d.buyerDocumentId} className="flex flex-wrap items-start gap-3 rounded-xl border border-border p-3">
      <IdentificationCardIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">
          {idLabel(d.documentType)} <DocBadge status={d.verificationStatus} />
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Uploaded {formatDateTime(d.createdAtUtc)}
          {d.expiresAt ? ` · expires ${formatDate(d.expiresAt)}` : ""}
        </p>
        {d.reviewRemark && <p className="mt-1 text-xs text-foreground">Reviewer note: {d.reviewRemark}</p>}
        {note}
      </div>
      {actions}
    </li>
  );

  return (
    <StepShell n={2} title="Upload your ID" done={current.length > 0}>
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <div className="space-y-3">
          {stale.length > 0 && editable && (
            <Notice tone="warning" title="Remove your previous ID first">
              The ID from your earlier verification can't be used again. Remove it below, then upload a current ID.
            </Notice>
          )}
          {(current.length > 0 || stale.length > 0) && (
            <ul className="space-y-2" aria-label="Your ID">
              {[...current, ...stale].map((d) =>
                row(
                  d,
                  editable && d.verificationStatus.toUpperCase() !== "VERIFIED" ? (
                    <Button size="sm" variant="ghost" loading={busyId === d.buyerDocumentId} onClick={() => void remove(d)}>
                      <TrashIcon /> {isStale(d) ? "Remove" : "Replace"}
                    </Button>
                  ) : editable && isStale(d) ? (
                    <Button size="sm" variant="ghost" loading={busyId === d.buyerDocumentId} onClick={() => void remove(d)}>
                      <TrashIcon /> Remove
                    </Button>
                  ) : undefined,
                  isStale(d) ? <p className="mt-1 text-xs text-warning-soft-foreground">From your previous verification</p> : undefined,
                ),
              )}
            </ul>
          )}
          {canUpload && (
            <div className="rounded-xl border border-dashed border-border-strong p-5 text-center">
              <FileArrowUpIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-medium text-foreground">Upload one clear photo or scan of your {idLabel(p.documentType)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">PDF, JPG or PNG, up to 20 MB. All details must be readable and match what you entered above.</p>
              <input
                ref={inputRef}
                type="file"
                accept={FILE_LIMITS.BUYER_DOCUMENT.accept}
                className="sr-only"
                id="v-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
              {progress !== null ? (
                <div className="mx-auto mt-4 max-w-xs" role="status" aria-label="Uploading">
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div className="h-full bg-foreground transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Uploading… {Math.round(progress * 100)}%</p>
                </div>
              ) : (
                <Button className="mt-4" onClick={() => inputRef.current?.click()}>
                  Choose file
                </Button>
              )}
            </div>
          )}
          {editable && !detailsReady && <p className="text-sm text-muted-foreground">Save your details first, then upload your ID.</p>}
          {!editable && current.length === 0 && stale.length === 0 && <p className="text-sm text-muted-foreground">No ID on file.</p>}
          {problem && <Notice tone="danger">{problem}</Notice>}
          {history.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Earlier uploads ({history.length})</summary>
              <ul className="mt-2 space-y-2">{history.map((d) => row(d))}</ul>
            </details>
          )}
        </div>
      )}
    </StepShell>
  );
}

function DocBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  return (
    <Badge tone={s === "VERIFIED" ? "success" : s === "REJECTED" ? "danger" : "neutral"} className="ml-1 align-middle">
      {s === "VERIFIED" ? "Approved" : s === "REJECTED" ? "Not accepted" : "Not reviewed yet"}
    </Badge>
  );
}

function SubmitStep({ p, documents }: { p: BuyerProfileDto; documents: BuyerDocumentResponse[] }) {
  const qc = useQueryClient();
  const gate = usePolicyGate();
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const cutoff = p.requiresReverification && p.reverificationRequiredAtUtc ? new Date(p.reverificationRequiredAtUtc).getTime() : null;
  const active = documents.filter((d) => d.verificationStatus.toUpperCase() !== "REJECTED");
  const fresh = active.filter((d) => isIdDoc(d) && (cutoff === null || new Date(d.createdAtUtc).getTime() >= cutoff));
  const ready = fresh.length === 1 && active.filter(isIdDoc).length === 1;

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const latest = await marketplaceService.buyerProfile(); // fresh rowVersion
      const updated = await marketplaceService.submitBuyer(latest.rowVersion);
      qc.setQueryData(verificationKeys.profile, updated);
      void qc.invalidateQueries({ queryKey: verificationKeys.documents });
      void qc.invalidateQueries({ queryKey: buyerEligibilityKey });
      toast.success("Submitted. We'll review your ID, usually within 2 business days.");
    } catch (e) {
      setProblem(verificationMessage(e));
      if (isApiError(e) && e.code === "POLICY_ACCEPTANCE_REQUIRED") void gate.recheck();
      if (isApiError(e) && (e.code === "MARKETPLACE_BUYER_VERSION_CONFLICT" || e.code === "INVALID_ROW_VERSION")) void qc.invalidateQueries({ queryKey: verificationKeys.profile });
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepShell n={3} title="Submit for review">
      <p className="text-sm text-body">A StockOut team member checks that your ID is valid and matches your details. You'll see the result here.</p>
      {p.pendingPolicies.length > 0 && (
        <Notice tone="warning" className="mt-3">
          You need to accept the latest StockOut terms before submitting.{" "}
          <button type="button" className="cursor-pointer underline underline-offset-4" onClick={() => void gate.recheck()}>
            Review terms
          </button>
        </Notice>
      )}
      {problem && (
        <Notice tone="danger" className="mt-3">
          {problem}
        </Notice>
      )}
      <Button className="mt-4" onClick={() => void submit()} loading={busy} disabled={!ready}>
        Submit for review
      </Button>
      {!ready && <p className="mt-2 text-xs text-muted-foreground">Upload your ID first.</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        Questions? See our <Link to="/legal" className="underline underline-offset-4">policies</Link> or email info@stockoutme.com.
      </p>
    </StepShell>
  );
}
