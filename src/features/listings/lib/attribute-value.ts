import { formatNumber } from "@/lib/utils/format";

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Display value of a listing attribute. Numeric attributes come back with a padded decimal string as
 * `textValue` ("9.0000"), so plain numbers are re-formatted ("9", "1.44"); descriptive text ("60 × 60", "8 mm") passes through.
 */
export function attributeDisplayValue(a: { textValue: string | null; numValue: number | null; numericValue?: number | null }): string | null {
  const text = a.textValue?.trim();
  if (text && !PLAIN_NUMBER.test(text)) return text;
  const num = a.numValue ?? a.numericValue ?? (text ? Number(text) : null);
  return num !== null && Number.isFinite(num) ? formatNumber(num) : null;
}
