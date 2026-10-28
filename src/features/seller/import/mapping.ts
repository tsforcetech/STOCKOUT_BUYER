/**
 * "Use your own Excel": the seller's sheet is matched to the StockOut import columns and converted into the
 * template the server reads. BulkImportService reads the "Products" sheet BY POSITION (columns 1–19, data from
 * row 2), so TARGETS must stay in exactly this order.
 */

export type FieldKind = "text" | "number" | "date";
export interface TargetField {
  key: string;
  header: string;
  label: string;
  required?: boolean;
  kind: FieldKind;
  /** Lower-case words/phrases that identify this column in a seller's sheet. */
  synonyms: string[];
  /** Offered as "same value for every row". */
  fixedHint?: string;
  defaultFixed?: string;
  /** Rarely changed; shown under "More fields". */
  advanced?: boolean;
}

export const TARGETS: TargetField[] = [
  { key: "sku", header: "Seller SKU*", label: "Item code / SKU", required: true, kind: "text", synonyms: ["sku", "seller sku", "item code", "item no", "item number", "product code", "part number", "part no", "code", "ref", "reference", "article"] },
  { key: "title", header: "Title*", label: "Product name", required: true, kind: "text", synonyms: ["title", "product name", "item name", "name", "product", "item", "material", "description of goods", "item description"] },
  { key: "category", header: "Category Code or ID*", label: "Category", required: true, kind: "text", synonyms: ["category", "category code", "group", "item group", "product group", "family", "type"], fixedHint: "Choose one category for every row" },
  { key: "description", header: "Description", label: "Description", kind: "text", synonyms: ["description", "details", "specification", "specs", "remarks", "notes", "long description"] },
  { advanced: true, key: "pricingMode", header: "Pricing Mode", label: "Pricing mode", kind: "text", synonyms: ["pricing mode", "price type", "sale type"], defaultFixed: "FIXED_PRICE" },
  { advanced: true, key: "currency", header: "Currency", label: "Currency", kind: "text", synonyms: ["currency", "curr", "ccy"], defaultFixed: "AED" },
  { key: "price", header: "Base Price*", label: "Price per unit", required: true, kind: "number", synonyms: ["price", "unit price", "base price", "rate", "selling price", "sale price", "unit cost", "cost", "amount per unit", "price aed", "rate aed"] },
  { key: "brand", header: "Brand Name or ID", label: "Brand", kind: "text", synonyms: ["brand", "make", "manufacturer", "mfr", "oem"] },
  { key: "condition", header: "Condition", label: "Condition", kind: "text", synonyms: ["condition", "state", "new used"], fixedHint: "e.g. Brand New" },
  { advanced: true, key: "grade", header: "Grade", label: "Grade", kind: "text", synonyms: ["grade", "quality"] },
  { key: "quantity", header: "Quantity*", label: "Quantity", required: true, kind: "number", synonyms: ["quantity", "qty", "stock", "available", "balance", "on hand", "closing stock", "qty available", "units"] },
  { key: "unit", header: "Quantity Unit*", label: "Unit", required: true, kind: "text", synonyms: ["unit", "uom", "unit of measure", "units of measure", "measure"], fixedHint: "e.g. PCS, M, KG" },
  { advanced: true, key: "country", header: "Country Code", label: "Country", kind: "text", synonyms: ["country", "country code"], defaultFixed: "AE" },
  { key: "emirate", header: "State or Emirate", label: "Emirate", kind: "text", synonyms: ["emirate", "state", "region", "location"], fixedHint: "e.g. Dubai" },
  { key: "city", header: "City", label: "City / area", kind: "text", synonyms: ["city", "area", "town", "warehouse location"] },
  { advanced: true, key: "expiry", header: "Expiry Date (UTC)", label: "Expiry date", kind: "date", synonyms: ["expiry", "expiry date", "expiration", "best before", "exp date"] },
  { key: "images", header: "Image References", label: "Image file names", kind: "text", synonyms: ["image", "images", "photo", "photos", "picture", "image file", "image name"] },
  { advanced: true, key: "cover", header: "Cover Image", label: "Cover image", kind: "text", synonyms: ["cover", "cover image", "main image", "main photo"] },
  { advanced: true, key: "attributes", header: "Dynamic Attributes (Key:Value)", label: "Attributes (Key:Value; …)", kind: "text", synonyms: ["attributes", "specs key value"] },
];
export const TEMPLATE_HEADERS = TARGETS.map((t) => t.header);

/** How one StockOut field gets its value. */
export type FieldSource = { kind: "column"; col: number } | { kind: "fixed"; value: string } | { kind: "auto" } | { kind: "none" };
export type Mapping = Record<string, FieldSource>;

export type Cell = string | number | boolean | Date | null | undefined;
export type Sheet = { name: string; rows: Cell[][] };

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const isBlank = (v: Cell) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** The first of the top 15 rows with at least two text cells — usually the headings. */
export function detectHeaderRow(rows: Cell[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const texts = (rows[i] ?? []).filter((c) => typeof c === "string" && c.trim() && !/^\d+([.,]\d+)?$/.test(c.trim()));
    if (texts.length >= 2) return i;
  }
  return 0;
}

export function headersOf(rows: Cell[][], headerRow: number): string[] {
  const width = Math.max(0, ...rows.slice(headerRow, headerRow + 50).map((r) => r?.length ?? 0));
  return Array.from({ length: width }, (_, i) => {
    const v = rows[headerRow]?.[i];
    return isBlank(v) ? `Column ${columnLetter(i)}` : String(v).trim();
  });
}

export function columnLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Best guess for every field: exact synonym, then contains; each seller column is used once. */
export function autoMap(headers: string[]): Mapping {
  const used = new Set<number>();
  const mapping: Mapping = {};
  const h = headers.map(norm);
  for (const pass of ["exact", "contains"] as const) {
    for (const t of TARGETS) {
      if (mapping[t.key]?.kind === "column") continue;
      const col = h.findIndex((name, i) => !used.has(i) && t.synonyms.some((s) => (pass === "exact" ? name === s : name.includes(s) && s.length >= 3)));
      if (col >= 0) {
        mapping[t.key] = { kind: "column", col };
        used.add(col);
      }
    }
  }
  for (const t of TARGETS) {
    if (mapping[t.key]) continue;
    if (t.key === "sku") mapping[t.key] = { kind: "auto" };
    else if (t.defaultFixed) mapping[t.key] = { kind: "fixed", value: t.defaultFixed };
    else mapping[t.key] = { kind: "none" };
  }
  return mapping;
}

/** "AED 1,250.50" → 1250.5; returns the text unchanged when it isn't a number (the server then reports it). */
export function toNumber(v: Cell): number | string {
  if (typeof v === "number") return v;
  if (isBlank(v)) return "";
  const s = String(v).replace(/[^\d.,-]/g, "");
  const dot = s.lastIndexOf(".");
  const comma = s.lastIndexOf(",");
  let cleaned: string;
  if (dot >= 0 && comma >= 0) cleaned = dot > comma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", "."); // the last separator is the decimal one
  else if (comma >= 0) cleaned = /,\d{3}$/.test(s) && s.indexOf(",") === comma ? s.replace(",", "") : s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  else cleaned = s.split(".").length > 2 ? s.replace(/\./g, "") : s;
  const n = Number(cleaned);
  return cleaned && Number.isFinite(n) ? n : String(v).trim();
}

/** Excel dates, serial numbers and dd/mm/yyyy text → yyyy-mm-dd. */
export function toIsoDate(v: Cell): string {
  if (isBlank(v)) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim();
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return s;
}

const text = (v: Cell) => (isBlank(v) ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

export interface ConvertOptions {
  /** Turns a category name/path from the seller's sheet into a StockOut category id; null when unknown. */
  resolveCategory?: (value: string) => string | null;
}

export interface ConvertedRow {
  sourceRow: number; // 1-based row number in the seller's sheet
  cells: (string | number)[];
  missing: string[];
  notes: string[];
}

/** Converts the data rows (below the heading row) into template rows; blank rows are skipped. */
export function convert(rows: Cell[][], headerRow: number, mapping: Mapping, options: ConvertOptions = {}): ConvertedRow[] {
  const out: ConvertedRow[] = [];
  let seq = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.every(isBlank)) continue;
    seq++;
    const missing: string[] = [];
    const notes: string[] = [];
    const cells = TARGETS.map((t) => {
      const src = mapping[t.key] ?? { kind: "none" };
      let raw: Cell = src.kind === "column" ? row[src.col] : src.kind === "fixed" ? src.value : src.kind === "auto" ? `ROW-${String(seq).padStart(4, "0")}` : "";
      if (t.key === "category" && src.kind === "column" && !isBlank(raw) && options.resolveCategory) {
        const id = options.resolveCategory(text(raw));
        if (id) raw = id;
        else notes.push(`Category "${text(raw)}" isn't a StockOut category`);
      }
      const value = t.kind === "number" ? toNumber(raw) : t.kind === "date" ? toIsoDate(raw) : text(raw);
      if (t.required && (value === "" || value === null)) missing.push(t.label);
      if (t.kind === "number" && typeof value === "string" && value !== "") notes.push(`${t.label} "${value}" isn't a number`);
      return value;
    });
    out.push({ sourceRow: r + 1, cells, missing, notes });
  }
  return out;
}

/** Stable signature of a sheet's headings, used to remember the seller's mapping for next time. */
export const headerSignature = (headers: string[]) => headers.map(norm).join("|");

const STORE = "stockout.import.mappings";
export function loadSavedMapping(signature: string): Mapping | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, Mapping>;
    return all[signature] ?? null;
  } catch {
    return null;
  }
}
export function saveMapping(signature: string, mapping: Mapping): void {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, Mapping>;
    all[signature] = mapping;
    const keys = Object.keys(all);
    if (keys.length > 20) delete all[keys[0]];
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* storage unavailable: mapping just isn't remembered */
  }
}

/** Blob → ArrayBuffer / text via FileReader (works where Blob.arrayBuffer()/text() don't, e.g. older Safari). */
export function readAs<T extends "arrayBuffer" | "text">(blob: Blob, as: T): Promise<T extends "text" ? string : ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T extends "text" ? string : ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("The file couldn't be read."));
    if (as === "text") reader.readAsText(blob);
    else reader.readAsArrayBuffer(blob);
  });
}

/** Reads the seller's file: every sheet of an .xlsx, or a .csv as one sheet. */
export async function readSellerFile(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const { parseCsv } = await import("../bulk/csv");
    const text = await readAs(file, "text");
    const delimiter = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    const parsed = parseCsv(text, delimiter);
    if (parsed.error) throw new Error(parsed.error);
    return [{ name: file.name, rows: parsed.rows }];
  }
  if (!name.endsWith(".xlsx")) throw new Error("Use an Excel .xlsx file or a .csv file. For an old .xls file, open it in Excel and use File › Save As › Excel Workbook (.xlsx).");
  const { default: readExcelFile } = await import("read-excel-file/universal");
  const sheets = (await readExcelFile(await readAs(file, "arrayBuffer"))) as Array<{ sheet: string; data: Cell[][] }>;
  return sheets.map((s) => ({ name: s.sheet, rows: s.data }));
}

/** Writes converted rows as the StockOut template ("Products" sheet, headings in row 1). */
export async function writeTemplate(rows: ConvertedRow[]): Promise<File> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  const data = [TEMPLATE_HEADERS, ...rows.map((r) => r.cells.map((c) => (c === "" ? null : c)))];
  const blob = await writeExcelFile(data, { sheet: "Products" }).toBlob();
  return new File([blob], "stockout_import_from_your_sheet.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
