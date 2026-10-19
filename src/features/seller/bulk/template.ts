import { SELLER_LISTING_LIMITS as L } from "@/api/types/seller-listings";
import { FILE_LIMITS } from "@/services/files.service";
import { toCsvText } from "./csv";
import { BULK_COLUMNS, MAX_BULK_ROWS, type BulkColumn } from "./rows";

export interface ColumnHelp {
  column: BulkColumn;
  required: boolean;
  description: string;
  example: string;
}

const IMAGE_MB = Math.round(FILE_LIMITS.LISTING_IMAGE.maxBytes / 1024 / 1024);

export const COLUMN_HELP: ColumnHelp[] = [
  { column: "title", required: true, description: `Listing title, up to ${L.TITLE_MAX_LENGTH} characters.`, example: "200 × Siemens 3RT2026 contactors, unused" },
  {
    column: "category",
    required: true,
    description: 'Category name, or its full path joined with ">" (e.g. "Electrical > Switchgear"). Matching ignores upper/lower case and must point to exactly one category.',
    example: "Electrical > Switchgear",
  },
  { column: "description", required: false, description: "Condition, packaging, specs, pickup details. Wrap text with commas or line breaks in double quotes (spreadsheet apps do this for you).", example: "Boxed, never installed. Pickup Jebel Ali." },
  { column: "price", required: true, description: "Price per listing in the currency below. Must be above 0, up to 4 decimals. Use a dot for decimals.", example: "1250.00" },
  { column: "currency", required: false, description: "3-letter code. Leave empty to use your seller account's default currency.", example: "AED" },
  { column: "quantity", required: true, description: "Stock on hand, 0 or more. Whole numbers only for units that don't allow decimals.", example: "200" },
  { column: "unit", required: false, description: "Unit code, symbol or name offered for the category (look them up below). Leave empty to use the category's default unit.", example: "PCS" },
  { column: "condition", required: false, description: "Condition code or name offered for the category (look them up below). Some categories need one for approval.", example: "NEW" },
  { column: "emirate", required: false, description: "Pickup emirate. Fill emirate and city together, or leave both empty (country is set to UAE).", example: "Dubai" },
  { column: "city", required: false, description: "Pickup city or area.", example: "Jebel Ali" },
  {
    column: "image_file",
    required: false,
    description: `File name of a photo you add in step 2 (e.g. contactor.jpg). JPG, PNG or WebP, up to ${IMAGE_MB} MB. Needed to submit for review.`,
    example: "contactor.jpg",
  },
];

export const TEMPLATE_NOTES = [
  "Rows whose first cell starts with # are ignored — the template's example rows use this. Delete them or leave them.",
  `Up to ${MAX_BULK_ROWS} listings per file.`,
  "Working in Excel or Google Sheets? Keep the header row as is and save / download as CSV (UTF-8).",
];

/** Template with the header row and commented example rows. `exampleCategory` is a real path from the live tree when known. */
export function buildTemplateCsv(exampleCategory?: string): string {
  const example = (values: Partial<Record<BulkColumn, string>>) => BULK_COLUMNS.map((c) => values[c] ?? "");
  const category = exampleCategory ?? "Parent category > Child category";
  return toCsvText([
    [...BULK_COLUMNS],
    example({
      title: "# EXAMPLE (ignored) 200 × Siemens 3RT2026 contactors, unused",
      category,
      description: "Boxed, never installed.\nPickup Jebel Ali, weekdays 9–5.",
      price: "1250.00",
      currency: "AED",
      quantity: "200",
      unit: "PCS",
      condition: "NEW",
      emirate: "Dubai",
      city: "Jebel Ali",
      image_file: "contactor.jpg",
    }),
    example({ title: "# EXAMPLE (ignored) Steel rebar 12mm, surplus", category, price: "2.75", quantity: "1500", unit: "KG" }),
  ]);
}
