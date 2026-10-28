import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/misc";
import { FormError, FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { isApiError } from "@/lib/api/errors";
import { marketplaceService } from "@/services/marketplace.service";
import type { MarketplaceSellerDto } from "@/api/types/user-organization";
import { dateInputToUtcIso, isoToDateInput } from "../lib/listing";
import { sellerAccountErrorMessage } from "../lib/errors";
import { sellerKeys } from "../lib/queries";

/**
 * PUT /marketplace/sellers/{id}/profile (owner). Licence expiry is required and must be in the future (DEC-011);
 * VAT-registered businesses give a 15-digit TRN, others confirm the non-registration declaration.
 * The server treats null as "unchanged", so cleared optional fields are sent as "".
 */
const today = () => new Date().toISOString().slice(0, 10);
const opt = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer.`);

const schema = z
  .object({
    legalName: z.string().trim().min(1, "Enter the company's legal name.").max(200, "Use 200 characters or fewer."),
    displayName: z.string().trim().min(1, "Enter the name buyers will see.").max(200, "Use 200 characters or fewer."),
    tradeLicenseNumber: z.string().trim().min(1, "Enter the trade licence number.").max(100, "Use 100 characters or fewer."),
    issuingAuthority: z.string().trim().min(1, "Enter the issuing authority, for example DED Dubai.").max(150, "Use 150 characters or fewer."),
    tradeLicenseIssuedAtUtc: z.string(),
    tradeLicenseExpiresAtUtc: z.string().min(1, "Enter the licence expiry date."),
    isVatRegistered: z.boolean(),
    taxRegistrationNumber: z.string().trim(),
    hasVatDeclaration: z.boolean(),
    signatoryName: opt(200),
    signatoryEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]),
    signatoryPhone: opt(50),
    signatoryAuthorityRole: opt(100),
    businessContactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]),
    businessContactPhone: opt(50),
    addressLine1: opt(200),
    addressLine2: opt(200),
    city: opt(100),
    stateOrEmirate: opt(100),
    postalCode: opt(20),
    bankName: opt(150),
    bankAccountNumber: opt(50),
    bankIban: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, "").toUpperCase())
      .refine((v) => !v || /^AE[0-9A-Z]{21}$/.test(v), "Enter a UAE IBAN: AE followed by 21 characters."),
    bankSwiftCode: opt(11),
    bankBeneficiaryName: opt(200),
  })
  .refine((v) => v.tradeLicenseExpiresAtUtc > today(), { path: ["tradeLicenseExpiresAtUtc"], message: "The licence must not be expired. Renew it first." })
  .refine((v) => !v.tradeLicenseIssuedAtUtc || v.tradeLicenseIssuedAtUtc <= v.tradeLicenseExpiresAtUtc, { path: ["tradeLicenseIssuedAtUtc"], message: "Issue date must be before expiry." })
  .refine((v) => !v.isVatRegistered || /^\d{15}$/.test(v.taxRegistrationNumber), { path: ["taxRegistrationNumber"], message: "Enter the 15-digit TRN." })
  .refine((v) => v.isVatRegistered || v.hasVatDeclaration, { path: ["hasVatDeclaration"], message: "Confirm the declaration, or switch on VAT registered." });

type FormValues = z.input<typeof schema>;
type Values = z.output<typeof schema>;

function toForm(s: MarketplaceSellerDto): FormValues {
  const t = (v: string | null | undefined) => v ?? "";
  return {
    legalName: t(s.legalName),
    displayName: t(s.displayName),
    tradeLicenseNumber: t(s.tradeLicenseNumber ?? s.registrationNo),
    issuingAuthority: t(s.issuingAuthority),
    tradeLicenseIssuedAtUtc: isoToDateInput(s.tradeLicenseIssuedAtUtc),
    tradeLicenseExpiresAtUtc: isoToDateInput(s.tradeLicenseExpiresAtUtc),
    isVatRegistered: !!s.isVatRegistered,
    taxRegistrationNumber: t(s.taxRegistrationNumber),
    hasVatDeclaration: !!s.hasVatDeclaration,
    signatoryName: t(s.signatoryName),
    signatoryEmail: t(s.signatoryEmail),
    signatoryPhone: t(s.signatoryPhone),
    signatoryAuthorityRole: t(s.signatoryAuthorityRole),
    businessContactEmail: t(s.businessContactEmail),
    businessContactPhone: t(s.businessContactPhone),
    addressLine1: t(s.addressLine1),
    addressLine2: t(s.addressLine2),
    city: t(s.city),
    stateOrEmirate: t(s.stateOrEmirate),
    postalCode: t(s.postalCode),
    bankName: t(s.bankName),
    bankAccountNumber: t(s.bankAccountNumber),
    bankIban: t(s.bankIban),
    bankSwiftCode: t(s.bankSwiftCode),
    bankBeneficiaryName: t(s.bankBeneficiaryName),
  };
}

const FIELD_FOR_CODE: Record<string, keyof FormValues> = {
  SELLER_IBAN_INVALID: "bankIban",
  SELLER_TRN_INVALID: "taxRegistrationNumber",
  SELLER_LICENCE_EXPIRED: "tradeLicenseExpiresAtUtc",
  DUPLICATE_TRADE_LICENSE: "tradeLicenseNumber",
};

export function BusinessProfileDialog({
  seller,
  open,
  onOpenChange,
  licenceHint,
}: {
  seller: MarketplaceSellerDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** From the uploaded trade licence: fills empty licence fields so the seller only has to check them. */
  licenceHint?: { number?: string; issuedAt?: string; expiresAt?: string } | null;
}) {
  const [prefilled, setPrefilled] = React.useState(false);
  const qc = useQueryClient();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<FormValues, unknown, Values>({ resolver: zodResolver(schema), defaultValues: toForm(seller) });
  const errors = form.formState.errors;
  const vat = useWatch({ control: form.control, name: "isVatRegistered" });
  const declared = useWatch({ control: form.control, name: "hasVatDeclaration" });

  React.useEffect(() => {
    if (open) {
      const values = toForm(seller);
      let filled = false;
      if (licenceHint) {
        if (!values.tradeLicenseExpiresAtUtc && licenceHint.expiresAt) {
          values.tradeLicenseExpiresAtUtc = isoToDateInput(licenceHint.expiresAt);
          filled = true;
        }
        if (!values.tradeLicenseIssuedAtUtc && licenceHint.issuedAt) {
          values.tradeLicenseIssuedAtUtc = isoToDateInput(licenceHint.issuedAt);
          filled = true;
        }
        if (!values.tradeLicenseNumber && licenceHint.number) {
          values.tradeLicenseNumber = licenceHint.number;
          filled = true;
        }
      }
      form.reset(values);
      setPrefilled(filled);
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open]);

  const save = useApiMutation({
    toastOnError: false,
    mutationFn: async (v: Values) => {
      // expectedRowVersion from a fresh read so an unrelated earlier change doesn't fail the save.
      const fresh = await qc.fetchQuery({ queryKey: sellerKeys.seller(seller.sellerId), queryFn: ({ signal }) => marketplaceService.seller(seller.sellerId, signal), staleTime: 0 });
      return marketplaceService.updateSellerProfile(seller.sellerId, {
        ...v,
        tradeLicenseIssuedAtUtc: dateInputToUtcIso(v.tradeLicenseIssuedAtUtc),
        tradeLicenseExpiresAtUtc: dateInputToUtcIso(v.tradeLicenseExpiresAtUtc),
        taxRegistrationNumber: v.isVatRegistered ? v.taxRegistrationNumber : "",
        hasVatDeclaration: v.isVatRegistered ? false : v.hasVatDeclaration,
        expectedRowVersion: fresh.rowVersion,
      });
    },
    successMessage: "Business profile saved.",
    onSuccess: (updated) => {
      qc.setQueryData(sellerKeys.seller(seller.sellerId), updated);
      void qc.invalidateQueries({ queryKey: sellerKeys.eligibility(seller.sellerId) });
      onOpenChange(false);
    },
  });

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await save.mutateAsync(v);
    } catch (error) {
      const field = isApiError(error) && error.code ? FIELD_FOR_CODE[error.code] : undefined;
      if (field) form.setError(field, { message: sellerAccountErrorMessage(error) });
      else setFormError(sellerAccountErrorMessage(error, "Your business details changed since you opened them. Close and reopen to see the latest."));
    }
  });

  const busy = form.formState.isSubmitting;
  const field = (name: keyof FormValues, label: string, opts: { required?: boolean; hint?: string; type?: string; className?: string; autoComplete?: string; inputMode?: "numeric" | "email" | "tel"; max?: number } = {}) => (
    <FormField label={label} htmlFor={name} required={opts.required} error={errors[name]?.message as string | undefined} hint={opts.hint} className={opts.className}>
      <Input type={opts.type ?? "text"} autoComplete={opts.autoComplete} inputMode={opts.inputMode} maxLength={opts.max} {...form.register(name)} />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        size="xl"
        title="Business profile"
        description="Used for verification, invoices and payouts. Fields marked * are required before you can submit for review."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="business-profile-form" loading={busy}>
              Save profile
            </Button>
          </>
        }
      >
        <form id="business-profile-form" onSubmit={onSubmit} noValidate className="space-y-6">
          <FormError message={formError} />
          {prefilled && (
            <p role="status" className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-soft-foreground">
              Licence details were filled in from the trade licence you uploaded. Check them before saving.
            </p>
          )}
          <Section title="Company and licence">
            {field("legalName", "Legal name", { required: true, hint: "Exactly as on the trade licence.", max: 200 })}
            {field("displayName", "Display name", { required: true, hint: "Shown to buyers.", max: 200 })}
            {field("tradeLicenseNumber", "Trade licence no.", { required: true, max: 100 })}
            {field("issuingAuthority", "Issuing authority", { required: true, hint: "For example DED Dubai, DMCC, JAFZA.", max: 150 })}
            <FormField label="Licence issued on" htmlFor="tradeLicenseIssuedAtUtc" error={errors.tradeLicenseIssuedAtUtc?.message}>
              <Input type="date" max={today()} {...form.register("tradeLicenseIssuedAtUtc")} />
            </FormField>
            <FormField label="Licence expires on" htmlFor="tradeLicenseExpiresAtUtc" required error={errors.tradeLicenseExpiresAtUtc?.message}>
              <Input type="date" min={today()} {...form.register("tradeLicenseExpiresAtUtc")} />
            </FormField>
          </Section>

          <Section title="VAT">
            <div className="flex items-start gap-4 sm:col-span-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="isVatRegistered" className="text-sm font-medium text-foreground">
                  VAT registered
                </label>
                <p className="text-sm text-muted-foreground">Registered with the UAE Federal Tax Authority.</p>
              </div>
              <Switch id="isVatRegistered" checked={vat} onCheckedChange={(c) => form.setValue("isVatRegistered", c === true, { shouldValidate: form.formState.isSubmitted })} />
            </div>
            {vat ? (
              field("taxRegistrationNumber", "Tax Registration Number (TRN)", { required: true, hint: "15 digits.", inputMode: "numeric", max: 15 })
            ) : (
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                  <Checkbox
                    className="mt-0.5"
                    checked={declared}
                    onCheckedChange={(c) => form.setValue("hasVatDeclaration", c === true, { shouldValidate: form.formState.isSubmitted })}
                  />
                  <span>
                    I confirm the business isn't VAT registered, and I'll upload a signed non-registration declaration. <span className="text-danger" aria-hidden>*</span>
                  </span>
                </label>
                {errors.hasVatDeclaration?.message && <p className="mt-1 text-sm text-danger">{errors.hasVatDeclaration.message}</p>}
              </div>
            )}
          </Section>

          <Section title="Authorised signatory">
            {field("signatoryName", "Full name", { autoComplete: "name", max: 200 })}
            {field("signatoryAuthorityRole", "Role", { hint: "For example Managing Director, Partner.", max: 100 })}
            {field("signatoryEmail", "Email", { type: "email", autoComplete: "email", inputMode: "email" })}
            {field("signatoryPhone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel", max: 50 })}
          </Section>

          <Section title="Business contact and address">
            {field("businessContactEmail", "Contact email", { type: "email", inputMode: "email" })}
            {field("businessContactPhone", "Contact phone", { type: "tel", inputMode: "tel", max: 50 })}
            {field("addressLine1", "Address line 1", { autoComplete: "address-line1", className: "sm:col-span-2", max: 200 })}
            {field("addressLine2", "Address line 2", { autoComplete: "address-line2", className: "sm:col-span-2", max: 200 })}
            {field("city", "City", { autoComplete: "address-level2", max: 100 })}
            {field("stateOrEmirate", "Emirate", { autoComplete: "address-level1", max: 100 })}
            {field("postalCode", "PO Box / postal code", { autoComplete: "postal-code", max: 20 })}
          </Section>

          <Section title="Bank account for payouts">
            {field("bankBeneficiaryName", "Beneficiary name", { max: 200 })}
            {field("bankName", "Bank", { max: 150 })}
            {field("bankIban", "IBAN", { hint: "AE + 21 characters.", max: 34 })}
            {field("bankSwiftCode", "SWIFT / BIC", { max: 11 })}
            {field("bankAccountNumber", "Account number", { max: 50 })}
          </Section>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 font-heading text-base font-bold text-foreground">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
