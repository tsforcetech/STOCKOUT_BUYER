import { z } from "zod";
import { PRICING_MODES, SELLER_LISTING_LIMITS as L, type CreateListingDraftRequest, type ListingVersionDto } from "@/api/types/seller-listings";
import { decimalPattern, isoToDateInput } from "./listing";

/** Core listing fields (create L1 / update L4). Strings in the form; converted to the API shape on submit. */
export const listingFormSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(L.TITLE_MAX_LENGTH, `Use ${L.TITLE_MAX_LENGTH} characters or fewer.`),
    description: z.string(),
    pricingMode: z.enum(PRICING_MODES),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code, e.g. AED."),
    basePrice: z
      .string()
      .trim()
      .regex(decimalPattern(L.PRICE_DECIMAL_PLACES), `Enter a price of 0 or more, with up to ${L.PRICE_DECIMAL_PLACES} decimals.`),
    brandId: z.string(),
    conditionId: z.string(),
    gradeId: z.string(),
    quantityUnitId: z.string(),
    countryCode: z.string().trim().max(L.LOCATION_COUNTRY_CODE_MAX_LENGTH, `Use ${L.LOCATION_COUNTRY_CODE_MAX_LENGTH} characters or fewer.`),
    stateOrEmirate: z.string().trim().max(L.LOCATION_STATE_MAX_LENGTH, `Use ${L.LOCATION_STATE_MAX_LENGTH} characters or fewer.`),
    city: z.string().trim().max(L.LOCATION_CITY_MAX_LENGTH, `Use ${L.LOCATION_CITY_MAX_LENGTH} characters or fewer.`),
    expiresAt: z.string(),
  })
  .superRefine((v, ctx) => {
    const parts = [v.countryCode, v.stateOrEmirate, v.city];
    const filled = parts.filter(Boolean).length;
    if (filled > 0 && filled < 3) {
      (["countryCode", "stateOrEmirate", "city"] as const).forEach((k) => {
        if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: "Fill in country, emirate/state and city together, or leave all three empty." });
      });
    }
  });

export type ListingFormValues = z.infer<typeof listingFormSchema>;

export const LISTING_FORM_FIELDS = ["title", "description", "pricingMode", "currency", "basePrice", "brandId", "conditionId", "gradeId", "quantityUnitId", "countryCode", "stateOrEmirate", "city", "expiresAt"] as const;

export function emptyListingForm(currency: string, quantityUnitId: string | null): ListingFormValues {
  return {
    title: "",
    description: "",
    pricingMode: "FIXED_PRICE",
    currency,
    basePrice: "",
    brandId: "",
    conditionId: "",
    gradeId: "",
    quantityUnitId: quantityUnitId ?? "",
    countryCode: "",
    stateOrEmirate: "",
    city: "",
    expiresAt: "",
  };
}

export function listingFormFromVersion(v: ListingVersionDto, expiresAtUtc: string | null): ListingFormValues {
  return {
    title: v.title,
    description: v.description ?? "",
    pricingMode: v.pricingMode,
    currency: v.currency,
    basePrice: String(v.basePrice),
    brandId: v.brandId ?? "",
    conditionId: v.conditionId ?? "",
    gradeId: v.gradeId ?? "",
    quantityUnitId: v.quantityUnitId ?? "",
    countryCode: v.location?.countryCode ?? "",
    stateOrEmirate: v.location?.stateOrEmirate ?? "",
    city: v.location?.city ?? "",
    expiresAt: isoToDateInput(expiresAtUtc),
  };
}

/** Full payload (PUT is a full replacement: empty optional fields are sent as null and clear the value). */
export function listingPayload(v: ListingFormValues, categoryId: string): Required<CreateListingDraftRequest> {
  const location = v.countryCode && v.stateOrEmirate && v.city ? { countryCode: v.countryCode.toUpperCase(), stateOrEmirate: v.stateOrEmirate, city: v.city } : null;
  return {
    categoryId,
    title: v.title.trim(),
    description: v.description.trim() || null,
    pricingMode: v.pricingMode,
    currency: v.currency.toUpperCase(),
    basePrice: Number(v.basePrice),
    brandId: v.brandId || null,
    conditionId: v.conditionId || null,
    gradeId: v.gradeId || null,
    quantityUnitId: v.quantityUnitId || null,
    location,
    // Expire at the end of the chosen UTC day.
    expiresAtUtc: v.expiresAt ? `${v.expiresAt}T23:59:59Z` : null,
  };
}
