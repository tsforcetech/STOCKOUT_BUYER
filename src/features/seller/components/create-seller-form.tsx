import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BuildingsIcon, UserIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { marketplaceService } from "@/services/marketplace.service";
import type { MarketplaceSellerDto, SellerType } from "@/api/types/user-organization";
import { cn } from "@/lib/utils/cn";
import { sellerAccountErrorMessage } from "../lib/errors";

const schema = z
  .object({
    sellerType: z.enum(["BUSINESS", "INDIVIDUAL"]),
    displayName: z.string().trim().min(1, "Enter the name buyers will see.").max(200, "Use 200 characters or fewer."),
    legalName: z.string().trim().max(200, "Use 200 characters or fewer."),
    registrationNo: z.string().trim().max(100, "Use 100 characters or fewer."),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2,3}$/, "Use a 2-letter country code, for example AE."),
    defaultCurrency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code, for example AED."),
  })
  .superRefine((v, ctx) => {
    if (v.sellerType === "BUSINESS" && !v.legalName) ctx.addIssue({ code: "custom", path: ["legalName"], message: "Legal name is required for a business." });
  });

type Values = z.infer<typeof schema>;

const TYPES: Array<{ value: SellerType; title: string; body: string; icon: React.ReactNode }> = [
  { value: "BUSINESS", title: "Business", body: "A registered company or trading entity. Requires the legal name.", icon: <BuildingsIcon /> },
  { value: "INDIVIDUAL", title: "Individual", body: "Selling in your own name. One individual seller account per person.", icon: <UserIcon /> },
];

export function CreateSellerForm({ hasIndividual, onCreated }: { hasIndividual: boolean; onCreated: (seller: MarketplaceSellerDto) => Promise<void> | void }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { sellerType: "BUSINESS", displayName: "", legalName: "", registrationNo: "", countryCode: "AE", defaultCurrency: "AED" },
  });
  const sellerType = useWatch({ control: form.control, name: "sellerType" });
  const errors = form.formState.errors;

  const create = useApiMutation({ mutationFn: marketplaceService.createSeller, toastOnError: false });

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const seller = await create.mutateAsync({
        sellerType: v.sellerType,
        displayName: v.displayName,
        legalName: v.sellerType === "BUSINESS" ? v.legalName : v.legalName || null,
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
      <fieldset>
        <legend className="mb-2 text-sm text-body">
          Seller type <span className="text-danger" aria-hidden>*</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
          {TYPES.map((t) => {
            const disabled = t.value === "INDIVIDUAL" && hasIndividual;
            const checked = sellerType === t.value;
            return (
              <label
                key={t.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
                  checked ? "border-action-border bg-action-soft" : "border-border bg-surface hover:bg-surface-muted",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input type="radio" value={t.value} disabled={disabled} className="sr-only" {...form.register("sellerType")} />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface ring-1 ring-border [&_svg]:size-5" aria-hidden>
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-heading text-base font-bold text-foreground">{t.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {disabled ? "You already have an individual seller account — open it from the list above." : t.body}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Display name" htmlFor="displayName" required error={errors.displayName?.message} hint="Shown to buyers on your listings." className="sm:col-span-2">
          <Input maxLength={200} autoComplete="organization" {...form.register("displayName")} />
        </FormField>
        <FormField label="Legal name" htmlFor="legalName" required={sellerType === "BUSINESS"} error={errors.legalName?.message} hint="As it appears on your trade licence.">
          <Input maxLength={200} {...form.register("legalName")} />
        </FormField>
        <FormField label="Registration / licence no." htmlFor="registrationNo" error={errors.registrationNo?.message}>
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
