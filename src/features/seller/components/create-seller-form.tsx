import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BuildingsIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { marketplaceService } from "@/services/marketplace.service";
import type { MarketplaceSellerDto } from "@/api/types/user-organization";
import { sellerAccountErrorMessage } from "../lib/errors";

/** DEC-010: new sellers are companies only ("BUSINESS"); the legal name is required. */
const schema = z.object({
  displayName: z.string().trim().min(1, "Enter the name buyers will see.").max(200, "Use 200 characters or fewer."),
  legalName: z.string().trim().min(1, "Enter the company's legal name.").max(200, "Use 200 characters or fewer."),
  registrationNo: z.string().trim().max(100, "Use 100 characters or fewer."),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}$/, "Use a 2-letter country code, for example AE."),
  defaultCurrency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code, for example AED."),
});

type Values = z.infer<typeof schema>;

export function CreateSellerForm({ onCreated }: { onCreated: (seller: MarketplaceSellerDto) => Promise<void> | void }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", legalName: "", registrationNo: "", countryCode: "AE", defaultCurrency: "AED" },
  });
  const errors = form.formState.errors;

  const create = useApiMutation({ mutationFn: marketplaceService.createSeller, toastOnError: false });

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const seller = await create.mutateAsync({
        sellerType: "BUSINESS",
        displayName: v.displayName,
        legalName: v.legalName,
        registrationNo: v.registrationNo || null,
        countryCode: v.countryCode.toUpperCase(),
        defaultCurrency: v.defaultCurrency.toUpperCase(),
      });
      await onCreated(seller);
    } catch (error) {
      setFormError(sellerAccountErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormError message={formError} />
      <div className="flex gap-3 rounded-xl border border-action-border bg-action-soft p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface ring-1 ring-border [&_svg]:size-5" aria-hidden>
          <BuildingsIcon />
        </span>
        <span className="min-w-0">
          <span className="block font-heading text-base font-bold text-foreground">Business seller account</span>
          <span className="block text-sm text-muted-foreground">
            StockOut sellers are registered UAE companies. You'll need the trade licence, VAT certificate or declaration, signatory ID and authority, and a bank letter.
          </span>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Display name" htmlFor="displayName" required error={errors.displayName?.message} hint="Shown to buyers on your listings." className="sm:col-span-2">
          <Input maxLength={200} autoComplete="organization" {...form.register("displayName")} />
        </FormField>
        <FormField label="Legal name" htmlFor="legalName" required error={errors.legalName?.message} hint="As it appears on your trade licence.">
          <Input maxLength={200} {...form.register("legalName")} />
        </FormField>
        <FormField label="Trade licence no." htmlFor="registrationNo" error={errors.registrationNo?.message}>
          <Input maxLength={100} {...form.register("registrationNo")} />
        </FormField>
        <FormField label="Country code" htmlFor="countryCode" required error={errors.countryCode?.message} hint="ISO code, e.g. AE.">
          <Input maxLength={3} className="uppercase" autoComplete="country" {...form.register("countryCode")} />
        </FormField>
        <FormField label="Default currency" htmlFor="defaultCurrency" required error={errors.defaultCurrency?.message} hint="ISO code, e.g. AED.">
          <Input maxLength={3} className="uppercase" {...form.register("defaultCurrency")} />
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="lg" loading={form.formState.isSubmitting}>
          Create seller account
        </Button>
      </div>
    </form>
  );
}
