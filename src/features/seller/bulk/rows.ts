import { FILE_LIMITS } from "@/services/files.service";
import { SELLER_LISTING_LIMITS as L, LISTING_INVENTORY_LIMITS as I, type CreateListingDraftRequest, type ListingRequirementsResponse } from "@/api/types/seller-listings";
import { decimalPattern } from "../lib/listing";
import { parseCsv } from "./csv";

/** Template columns, in template order. */
export const BULK_COLUMNS = ["title", "category", "description", "price", "currency", "quantity", "unit", "condition", "emirate", "city", "image_file"] as const;
export type BulkColumn = (typeof BULK_COLUMNS)[number];
export const REQUIRED_COLUMNS: readonly BulkColumn[] = ["title", "category", "price", "quantity"];
export const MAX_BULK_ROWS = 200;
/** All bulk locations are in the UAE; the API needs country + emirate + city together. */
export const BULK_COUNTRY_CODE = "AE";

const ALIASES: Record<string, BulkColumn> = { image: "image_file", image_filename: "image_file", photo: "image_file", qty: "quantity", state: "emirate", emirate_state: "emirate" };

export interface BulkRecord {
  /** Stable client id (survives removing other rows). */
  id: string;
  /** Spreadsheet row number (1 = header row when the header is on the first line). */
  line: number;
  values: Record<BulkColumn, string>;
}

export interface ParsedSheet {
  records: BulkRecord[];
  /** Problems that stop the whole file from being used. */
  errors: string[];
  warnings: string[];
}

function normaliseHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\*$/, "")
    .replace(/[\s\-/]+/g, "_");
}

const isBlank = (row: string[]) => row.every((c) => c.trim() === "");

/** CSV text → records. Skips blank rows and rows whose first cell starts with "#" (comments / template examples). */
export function readSheet(text: string): ParsedSheet {
  let parsed = parseCsv(text);
  // Excel in some locales saves "CSV" with semicolons (or tabs). Detect from the header row.
  const firstRow = parsed.rows.find((r) => !isBlank(r));
  if (!parsed.error && firstRow && firstRow.length === 1) {
    if (firstRow[0].includes(";")) parsed = parseCsv(text, ";");
    else if (firstRow[0].includes("\t")) parsed = parseCsv(text, "\t");
  }
  if (parsed.error) return { records: [], errors: [parsed.error], warnings: [] };

  const headerIndex = parsed.rows.findIndex((r) => !isBlank(r));
  if (headerIndex < 0) return { records: [], errors: ["The file is empty."], warnings: [] };

  const errors: string[] = [];
  const warnings: string[] = [];
  const columnAt = new Map<number, BulkColumn>();
  const seen = new Set<BulkColumn>();
  const unknown: string[] = [];
  parsed.rows[headerIndex].forEach((raw, i) => {
    const key = normaliseHeader(raw);
    if (!key) return;
    const col = (BULK_COLUMNS as readonly string[]).includes(key) ? (key as BulkColumn) : ALIASES[key];
    if (!col) {
      unknown.push(raw.trim());
      return;
    }
    if (seen.has(col)) {
      errors.push(`The column "${col}" appears more than once.`);
      return;
    }
    seen.add(col);
    columnAt.set(i, col);
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !seen.has(c));
  if (missing.length) errors.push(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Start from the template so the header row matches.`);
  if (unknown.length) warnings.push(`Ignored unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`);
  if (errors.length) return { records: [], errors, warnings };

  const records: BulkRecord[] = [];
  for (let r = headerIndex + 1; r < parsed.rows.length; r++) {
    const row = parsed.rows[r];
    if (isBlank(row) || row[0].trim().startsWith("#")) continue;
    const values = Object.fromEntries(BULK_COLUMNS.map((c) => [c, ""])) as Record<BulkColumn, string>;
    columnAt.forEach((col, i) => {
      values[col] = (row[i] ?? "").trim();
    });
    records.push({ id: `row-${parsed.lines[r]}`, line: parsed.lines[r], values });
  }
  if (records.length === 0) return { records: [], errors: ["The file has a header row but no listing rows (rows starting with # are ignored)."], warnings };
  if (records.length > MAX_BULK_ROWS) {
    return { records: [], errors: [`The file has ${records.length} listing rows. The limit is ${MAX_BULK_ROWS} per file — split it into smaller files.`], warnings };
  }
  return { records, errors: [], warnings };
}

// ---------------------------------------------------------------------------
// Category / unit / condition resolution
// ---------------------------------------------------------------------------

export interface CategoryOption {
  categoryId: string;
  path: string[];
}

export type Resolution<T> = { ok: true; value: T } | { ok: false; error: string };

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
export const categoryLabel = (path: string[]) => path.join(" > ");

/** Matches a category by name or by (partial, ending) path "Parent > Child", case-insensitively. Must be unique. */
export function createCategoryMatcher(categories: CategoryOption[]): (input: string) => Resolution<CategoryOption> {
  const entries = categories.map((c) => ({ c, segs: c.path.map(norm) }));
  return (input) => {
    const segs = input.split(/\s*[>›]\s*/).map(norm).filter(Boolean);
    if (!segs.length) return { ok: false, error: "Enter a category." };
    const exact = entries.filter((e) => e.segs.length === segs.length && e.segs.every((s, i) => s === segs[i]));
    const hits = exact.length ? exact : entries.filter((e) => e.segs.length >= segs.length && segs.every((s, i) => e.segs[e.segs.length - segs.length + i] === s));
    if (hits.length === 1) return { ok: true, value: hits[0].c };
    if (!hits.length) return { ok: false, error: `No category matches "${input}". Use a category name or its full path, e.g. "Parent > Child".` };
    const examples = hits.slice(0, 3).map((h) => `"${categoryLabel(h.c.path)}"`);
    return { ok: false, error: `"${input}" matches ${hits.length} categories (${examples.join(", ")}${hits.length > 3 ? ", …" : ""}). Use the full path.` };
  };
}

type Unit = ListingRequirementsResponse["unitRules"]["units"][number];
type Condition = ListingRequirementsResponse["conditionRules"]["conditions"][number];

export const unitLabel = (u: Unit) => `${u.name}${u.symbol && u.symbol !== u.name ? ` (${u.symbol})` : ""}`;

function listOf(values: string[], max = 8) {
  return values.length > max ? `${values.slice(0, max).join(", ")}, …` : values.join(", ");
}

export function resolveUnit(input: string, req: ListingRequirementsResponse, categoryName: string): Resolution<Unit | null> {
  const units = req.unitRules.units;
  if (!input) return { ok: true, value: units.find((u) => u.unitId === req.unitRules.defaultUnitId) ?? null };
  const q = norm(input);
  const hits = units.filter((u) => [u.code, u.symbol, u.name].some((v) => v && norm(v) === q));
  if (hits.length === 1) return { ok: true, value: hits[0] };
  if (hits.length > 1) return { ok: false, error: `Unit "${input}" is ambiguous for ${categoryName}. Use the unit code (${listOf(hits.map((u) => u.code))}).` };
  if (!units.length) return { ok: false, error: `${categoryName} doesn't offer any units — leave "unit" empty.` };
  return { ok: false, error: `Unit "${input}" isn't offered for ${categoryName}. Use one of: ${listOf(units.map((u) => u.code))}.` };
}

export function resolveCondition(input: string, req: ListingRequirementsResponse, categoryName: string): Resolution<Condition | null> {
  const conditions = req.conditionRules.conditions;
  if (!input) return { ok: true, value: null };
  const q = norm(input);
  const hits = conditions.filter((c) => norm(c.code) === q || norm(c.name) === q);
  if (hits.length === 1) return { ok: true, value: hits[0] };
  if (hits.length > 1) return { ok: false, error: `Condition "${input}" is ambiguous for ${categoryName}. Use the condition code (${listOf(hits.map((c) => c.code))}).` };
  if (!conditions.length) return { ok: false, error: `${categoryName} doesn't offer any conditions — leave "condition" empty.` };
  return { ok: false, error: `Condition "${input}" isn't offered for ${categoryName}. Use one of: ${listOf(conditions.map((c) => c.code))}.` };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** Lower-cased file name (no folder) used to match `image_file` to a picked image. */
export const imageKey = (name: string) => (name.split(/[\\/]/).pop() ?? "").trim().toLowerCase();

/** Same checks filesService.upload runs before requesting an upload (size, MIME type, extension). */
export function checkImageFile(file: File): string | null {
  const limit = FILE_LIMITS.LISTING_IMAGE;
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (file.size <= 0) return `Image "${file.name}" is empty.`;
  if (file.size > limit.maxBytes) return `Image "${file.name}" is larger than ${Math.round(limit.maxBytes / 1024 / 1024)} MB.`;
  if (!limit.accept.split(",").includes(file.type.toLowerCase()) || !limit.extensions.includes(ext)) return `Image "${file.name}" must be ${limit.extensions.join(", ")} (JPEG, PNG or WebP).`;
  return null;
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

export type RequirementsState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: ListingRequirementsResponse };

export interface BulkContext {
  /** null while the category tree is loading. */
  matchCategory: ((input: string) => Resolution<CategoryOption>) | null;
  requirements: (categoryId: string) => RequirementsState;
  /** imageKey(name) → picked file. */
  images: ReadonlyMap<string, File>;
  /** Used when the currency cell is empty (the seller account's default currency). */
  defaultCurrency: string | null;
}

export interface RowCheck {
  state: "valid" | "invalid" | "checking";
  errors: string[];
  warnings: string[];
  category?: CategoryOption;
  unit?: Unit | null;
  condition?: Condition | null;
  image?: File | null;
  quantity?: number;
  /** Ready-to-send create body (only when state === "valid"). */
  draft?: Required<CreateListingDraftRequest>;
}

/** Accepts "1234.5" and Excel-style "1,234.50"; returns null for anything else. */
function plainNumber(input: string): string | null {
  const s = input.replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return s.replace(/,/g, "");
  return /^\d+(\.\d+)?$/.test(s) ? s : null;
}

/**
 * Mirrors the server rules for create (L1), media and initial stock (I1) so the review table predicts what will fail:
 * title 1–255, price > 0 with ≤4 decimals, 3-letter currency, category/unit/condition offered for the category,
 * quantity ≥ 0 within the unit's decimal precision, emirate + city together, image type/size per the files policy.
 */
export function validateRow(record: BulkRecord, ctx: BulkContext): RowCheck {
  const v = record.values;
  const errors: string[] = [];
  const warnings: string[] = [];
  let checking = false;

  // Title
  const title = v.title.trim();
  if (!title) errors.push("Enter a title.");
  else if (title.length > L.TITLE_MAX_LENGTH) errors.push(`Title is ${title.length} characters — use ${L.TITLE_MAX_LENGTH} or fewer.`);

  // Price
  let basePrice: number | null = null;
  const priceText = plainNumber(v.price);
  if (!v.price) errors.push("Enter a price above 0.");
  else if (priceText === null || !decimalPattern(L.PRICE_DECIMAL_PLACES).test(priceText))
    errors.push(`Price "${v.price}" isn't a valid number — use digits with up to ${L.PRICE_DECIMAL_PLACES} decimals, e.g. 1250.50.`);
  else if (Number(priceText) <= 0) errors.push("Price must be above 0.");
  else basePrice = Number(priceText);

  // Currency
  const currency = (v.currency || ctx.defaultCurrency || "").trim().toUpperCase();
  if (!currency) errors.push("Enter a 3-letter currency code, e.g. AED.");
  else if (!/^[A-Z]{3}$/.test(currency)) errors.push(`Currency "${v.currency}" must be a 3-letter code, e.g. AED.`);

  // Location
  const emirate = v.emirate.trim();
  const city = v.city.trim();
  if (!!emirate !== !!city) errors.push("Fill in both emirate and city, or leave both empty.");
  if (emirate.length > L.LOCATION_STATE_MAX_LENGTH) errors.push(`Emirate must be ${L.LOCATION_STATE_MAX_LENGTH} characters or fewer.`);
  if (city.length > L.LOCATION_CITY_MAX_LENGTH) errors.push(`City must be ${L.LOCATION_CITY_MAX_LENGTH} characters or fewer.`);

  // Image
  let image: File | null = null;
  if (v.image_file) {
    const file = ctx.images.get(imageKey(v.image_file));
    if (!file) errors.push(`Image "${v.image_file}" hasn't been added — add it in the images box.`);
    else {
      const problem = checkImageFile(file);
      if (problem) errors.push(problem);
      else image = file;
    }
  }

  // Category → unit, condition, quantity
  let category: CategoryOption | undefined;
  let unit: Unit | null | undefined;
  let condition: Condition | null | undefined;
  let quantity: number | null = null;
  const qtyText = plainNumber(v.quantity);
  if (!v.quantity) errors.push("Enter a quantity (0 or more).");
  else if (qtyText === null) errors.push(`Quantity "${v.quantity}" isn't a valid number of 0 or more.`);

  if (!v.category) errors.push("Enter a category.");
  else if (!ctx.matchCategory) checking = true;
  else {
    const res = ctx.matchCategory(v.category);
    if (!res.ok) errors.push(res.error);
    else {
      category = res.value;
      const name = `"${category.path[category.path.length - 1]}"`;
      const req = ctx.requirements(category.categoryId);
      if (req.state === "loading") checking = true;
      else if (req.state === "error") errors.push(`Couldn't load the units and conditions for ${name}: ${req.message}`);
      else {
        const u = resolveUnit(v.unit, req.data, name);
        if (u.ok) unit = u.value;
        else errors.push(u.error);
        const c = resolveCondition(v.condition, req.data, name);
        if (c.ok) condition = c.value;
        else errors.push(c.error);
        if (c.ok && !c.value && req.data.conditionRules.isConditionRequired) warnings.push(`${name} requires a condition for approval — add one here or in the editor before submitting.`);
        if (c.ok && c.value?.isGradeRequired) warnings.push(`Condition "${c.value.name}" needs a grade for approval — set it in the listing editor.`);
        if (u.ok && !u.value && req.data.unitRules.units.length) warnings.push("No unit set — stock will have no unit. Add a unit column value to be explicit.");

        if (qtyText !== null && u.ok) {
          const places = Math.min(u.value?.quantityDecimalPrecision ?? I.QUANTITY_DECIMAL_PLACES, I.QUANTITY_DECIMAL_PLACES);
          const pattern = places > 0 ? decimalPattern(places) : /^\d+$/;
          if (!pattern.test(qtyText))
            errors.push(places > 0 ? `Quantity can have at most ${places} decimal${places > 1 ? "s" : ""}${u.value ? ` for ${unitLabel(u.value)}` : ""}.` : `Quantity must be a whole number${u.value ? ` for ${unitLabel(u.value)}` : ""}.`);
          else {
            quantity = Number(qtyText);
            if (u.value?.minQuantity != null && quantity > 0 && quantity < u.value.minQuantity) warnings.push(`Quantity is below the usual minimum of ${u.value.minQuantity} for ${unitLabel(u.value)}.`);
            if (u.value?.maxQuantity != null && quantity > u.value.maxQuantity) warnings.push(`Quantity is above the usual maximum of ${u.value.maxQuantity} for ${unitLabel(u.value)}.`);
          }
        }
      }
    }
  }

  const base = { errors, warnings, category, unit, condition, image };
  if (errors.length) return { ...base, state: "invalid" };
  if (checking || !category || quantity === null || basePrice === null) return { ...base, state: "checking" };
  return {
    ...base,
    state: "valid",
    quantity,
    draft: {
      categoryId: category.categoryId,
      title,
      description: v.description.trim() || null,
      pricingMode: "FIXED_PRICE",
      currency,
      basePrice,
      brandId: null,
      conditionId: condition?.conditionId ?? null,
      gradeId: null,
      quantityUnitId: unit?.unitId ?? null,
      location: emirate && city ? { countryCode: BULK_COUNTRY_CODE, stateOrEmirate: emirate, city } : null,
      expiresAtUtc: null,
    },
  };
}
