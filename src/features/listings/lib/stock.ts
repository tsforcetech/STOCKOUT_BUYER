import { formatNumber } from "@/lib/utils/format";

/** Stock counts at or below this read as "Only N left". */
export const LOW_STOCK = 5;

/** "22 t available", or "Only 4 pcs left" when stock is low. */
export function stockLabel(quantity: number, unit: string | null | undefined): { text: string; low: boolean } {
  const u = unit ? ` ${unit}` : "";
  const low = quantity <= LOW_STOCK;
  return { text: low ? `Only ${formatNumber(quantity)}${u} left` : `${formatNumber(quantity)}${u} available`, low };
}
