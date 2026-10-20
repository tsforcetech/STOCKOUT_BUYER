import * as React from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { FormError, FormField } from "@/components/forms/form-field";
import { PRICING_MODES, SELLER_LISTING_LIMITS as L, type CreateListingDraftRequest } from "@/api/types/seller-listings";
import { errorCode, sellerErrorMessage } from "../lib/errors";
import { PRICING_MODE_LABELS } from "../lib/listing";
import { listingFormSchema, listingPayload, type ListingFormValues } from "../lib/listing-form";
import { useListingRequirements } from "../lib/queries";
import { Notice } from "./notice";

/** API error code → form field it belongs to. */
const CODE_FIELD: Record<string, Path<ListingFormValues>> = {
  MARKETPLACE_LISTING_CURRENCY_INVALID: "currency",
  MARKETPLACE_LISTING_PRICE_INVALID: "basePrice",
  MARKETPLACE_LISTING_BRAND_INVALID: "brandId",
  MARKETPLACE_LISTING_CONDITION_INVALID: "conditionId",
  MARKETPLACE_LISTING_GRADE_INVALID: "gradeId",
  MARKETPLACE_LISTING_UNIT_INVALID: "quantityUnitId",
  MARKETPLACE_INVENTORY_UNIT_CHANGE_BLOCKED: "quantityUnitId",
  MARKETPLACE_LISTING_LOCATION_INVALID: "city",
};

interface Props {
  categoryId: string;
  categoryLabel: React.ReactNode;
  onChangeCategory?: () => void;
  defaultValues: ListingFormValues;
  readOnly?: boolean;
  submitLabel: string;
  /** Throw to keep the form as-is and show the error. */
  onSubmit: (payload: Required<CreateListingDraftRequest>) => Promise<void>;
  children?: React.ReactNode;
}

function Missing({ value, options }: { value: string; options: Array<{ id: string }> }) {
  if (!value || options.some((o) => o.id === value)) return null;
  return <option value={value}>Current selection (not offered for this category)</option>;
}

export function ListingDetailsForm({ categoryId, categoryLabel, onChangeCategory, defaultValues, readOnly, submitLabel, onSubmit, children }: Props) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<ListingFormValues>({ resolver: zodResolver(listingFormSchema), defaultValues });
  const req = useListingRequirements(categoryId);
  const errors = form.formState.errors;
  const [conditionId, pricingMode, basePrice, expiresAt, brandId, quantityUnitId] = useWatch({
    control: form.control,
    name: ["conditionId", "pricingMode", "basePrice", "expiresAt", "brandId", "quantityUnitId"],
  });

  const brands = (req.data?.brands ?? []).map((b) => ({ id: b.brandId, label: b.name }));
  const conditionRules = req.data?.conditionRules;
  const conditions = conditionRules?.conditions ?? [];
  const selectedCondition = conditions.find((c) => c.conditionId === conditionId);
  const grades = (selectedCondition?.grades ?? []).map((g) => ({ id: g.gradeId, label: g.name }));
  const units = (req.data?.unitRules.units ?? []).map((u) => ({ id: u.unitId, label: `${u.name}${u.symbol ? ` (${u.symbol})` : ""}` }));

  // Default the unit on a fresh form once the category's unit rules are known.
  const { getValues, setValue } = form;
  React.useEffect(() => {
    const def = req.data?.unitRules.defaultUnitId;
    if (def && !getValues("quantityUnitId") && !readOnly) setValue("quantityUnitId", def);
  }, [req.data, getValues, setValue, readOnly]);

  // Clear a grade that doesn't belong to the newly chosen condition.
  React.useEffect(() => {
    const g = getValues("gradeId");
    if (g && selectedCondition && !selectedCondition.grades.some((x) => x.gradeId === g)) setValue("gradeId", "");
  }, [selectedCondition, getValues, setValue]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(listingPayload(values, categoryId));
      form.reset(values);
    } catch (error) {
      const field = CODE_FIELD[errorCode(error) ?? ""];
      if (field) form.setError(field, { type: "server", message: sellerErrorMessage(error) });
      else setFormError(sellerErrorMessage(error));
    }
  });

  const today = new Date().toISOString().slice(0, 10);
  const optionalSelect = (loading: boolean, hasOptions: boolean, noneLabel: string) => (loading ? "Loading…" : hasOptions ? noneLabel : "None offered for this category");

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FormError message={formError} />
      <fieldset disabled={readOnly || form.formState.isSubmitting} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="truncate text-sm font-medium text-foreground">{categoryLabel}</p>
          </div>
          {onChangeCategory && (
            <Button variant="secondary" size="sm" onClick={onChangeCategory}>
              Change category
            </Button>
          )}
        </div>
        {req.data?.requiresPhysicalInspection && (
          <Notice tone="info" title="This category needs a physical inspection">
            After the marketplace team approves your listing, an inspector checks the goods at your warehouse before it goes live.
          </Notice>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Title" htmlFor="title" required error={errors.title?.message} className="sm:col-span-2">
            <Input maxLength={L.TITLE_MAX_LENGTH} placeholder="e.g. 200 × Siemens 3RT2026 contactors, unused" {...form.register("title")} />
          </FormField>
          <FormField label="Description" htmlFor="description" error={errors.description?.message} hint="Condition, packaging, specs, pickup details." className="sm:col-span-2">
            <Textarea rows={5} {...form.register("description")} />
          </FormField>
        </div>

        <section aria-labelledby="pricing-heading" className="space-y-4">
          <h3 id="pricing-heading" className="font-heading text-base font-bold text-foreground">
            Pricing
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Pricing mode" htmlFor="pricingMode" required error={errors.pricingMode?.message}>
              <NativeSelect {...form.register("pricingMode")}>
                {PRICING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {PRICING_MODE_LABELS[m]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label={pricingMode === "BIDDING" ? "Starting price" : "Price"}
              htmlFor="basePrice"
              required
              error={errors.basePrice?.message}
              hint={basePrice.trim() !== "" && Number(basePrice) === 0 ? "A draft can be saved at 0, but the price must be above 0 to submit." : "Must be above 0 to submit for review."}
            >
              <Input inputMode="decimal" placeholder="0.00" {...form.register("basePrice")} />
            </FormField>
            <FormField label="Currency" htmlFor="currency" required error={errors.currency?.message}>
              <Input maxLength={L.CURRENCY_LENGTH} className="uppercase" {...form.register("currency")} />
            </FormField>
          </div>
        </section>

        <section aria-labelledby="item-heading" className="space-y-4">
          <h3 id="item-heading" className="font-heading text-base font-bold text-foreground">
            Item details
          </h3>
          {req.error ? (
            <Notice tone="danger" title="Couldn't load the options for this category" action={<Button variant="secondary" size="sm" onClick={() => void req.refetch()}>Try again</Button>}>
              {errorCode(req.error) === "CATEGORY_INACTIVE" ? "This category is inactive. Choose another category." : sellerErrorMessage(req.error)}
            </Notice>
          ) : req.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Brand" htmlFor="brandId" error={errors.brandId?.message}>
                <NativeSelect {...form.register("brandId")}>
                  <option value="">{optionalSelect(req.isLoading, brands.length > 0, "No brand / unbranded")}</option>
                  {brands.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                  <Missing value={brandId} options={brands} />
                </NativeSelect>
              </FormField>
              <FormField label="Quantity unit" htmlFor="quantityUnitId" error={errors.quantityUnitId?.message} hint="The unit your stock and price refer to.">
                <NativeSelect {...form.register("quantityUnitId")}>
                  <option value="">{optionalSelect(req.isLoading, units.length > 0, "Choose a unit")}</option>
                  {units.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                  <Missing value={quantityUnitId} options={units} />
                </NativeSelect>
              </FormField>
              <FormField
                label="Condition"
                htmlFor="conditionId"
                error={errors.conditionId?.message}
                hint={conditionRules?.isConditionRequired ? "This category requires a condition for approval." : undefined}
              >
                <NativeSelect {...form.register("conditionId")}>
                  <option value="">{optionalSelect(req.isLoading, conditions.length > 0, "Not specified")}</option>
                  {conditions.map((c) => (
                    <option key={c.conditionId} value={c.conditionId}>
                      {c.name}
                    </option>
                  ))}
                  <Missing value={conditionId} options={conditions.map((c) => ({ id: c.conditionId }))} />
                </NativeSelect>
              </FormField>
              <FormField
                label="Grade"
                htmlFor="gradeId"
                error={errors.gradeId?.message}
                hint={selectedCondition?.isGradeRequired ? "This condition requires a grade for approval." : !conditionId ? "Choose a condition first." : undefined}
              >
                <NativeSelect disabled={!conditionId || grades.length === 0} {...form.register("gradeId")}>
                  <option value="">{conditionId ? (grades.length ? "Not specified" : "No grades for this condition") : "—"}</option>
                  {grades.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          )}
        </section>

        <section aria-labelledby="location-heading" className="space-y-4">
          <div>
            <h3 id="location-heading" className="font-heading text-base font-bold text-foreground">
              Location &amp; availability
            </h3>
            <p className="text-sm text-muted-foreground">Where buyers collect or inspect the goods. Fill in all three location fields or none.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Country code" htmlFor="countryCode" error={errors.countryCode?.message}>
              <Input maxLength={L.LOCATION_COUNTRY_CODE_MAX_LENGTH} placeholder="AE" className="uppercase" {...form.register("countryCode")} />
            </FormField>
            <FormField label="Emirate / state" htmlFor="stateOrEmirate" error={errors.stateOrEmirate?.message}>
              <Input maxLength={L.LOCATION_STATE_MAX_LENGTH} placeholder="Dubai" {...form.register("stateOrEmirate")} />
            </FormField>
            <FormField label="City" htmlFor="city" error={errors.city?.message}>
              <Input maxLength={L.LOCATION_CITY_MAX_LENGTH} placeholder="Jebel Ali" {...form.register("city")} />
            </FormField>
            <FormField
              label="Listing expires on"
              htmlFor="expiresAt"
              error={errors.expiresAt?.message}
              hint={expiresAt && expiresAt < today ? "This date has passed — the listing would expire as soon as it's published." : "Optional. The listing is hidden after this date (UTC)."}
            >
              <Input type="date" {...form.register("expiresAt")} />
            </FormField>
          </div>
        </section>
      </fieldset>

      {children}
      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
