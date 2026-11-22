/**
 * Freight shown before checkout (owner decision EMERGENCY-FREIGHT-2026-11-22): AED 10.00 gross, VAT included, once per
 * marketplace order whatever the number of sellers. Display only: checkout readiness is the price authority.
 */
export const FREIGHT_FEE_AED = 10;
/** Only AED prices get the freight hint (the fee is in AED). */
export const showsFreight = (currency: string | null | undefined) => (currency ?? "AED").toUpperCase() === "AED";
