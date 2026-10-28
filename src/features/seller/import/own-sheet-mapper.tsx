import * as React from "react";
import { CheckCircleIcon, FileXlsIcon, WarningIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { formatBytes, formatNumber } from "@/lib/utils/format";
import { useCategoryIndex } from "../lib/queries";
import { DropZone } from "../bulk/drop-zone";
import { createCategoryMatcher } from "../bulk/rows";
import { Notice } from "../components/notice";
import {
  TARGETS,
  autoMap,
  columnLetter,
  convert,
  detectHeaderRow,
  headerSignature,
  headersOf,
  loadSavedMapping,
  readSellerFile,
  saveMapping,
  writeTemplate,
  type Cell,
  type ConvertedRow,
  type FieldSource,
  type Mapping,
  type Sheet,
} from "./mapping";

const MAX_BYTES = 50 * 1024 * 1024;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICING_MODES = [
  { value: "FIXED_PRICE", label: "Fixed price" },
  { value: "NEGOTIATION", label: "Open to offers" },
  { value: "AUCTION", label: "Auction" },
];

export interface ConvertedSheet {
  file: File;
  sourceName: string;
  rows: number;
}

/**
 * "Use your own Excel": read the seller's .xlsx/.csv in the browser, let them match their columns to ours (or set
 * one value for every row), preview the result, and hand back a file in the StockOut template format.
 * Nothing is uploaded here; the server still validates every row after upload.
 */
export function OwnSheetMapper({ disabled, onReady, onClear }: { disabled?: boolean; onReady: (result: ConvertedSheet) => void; onClear: () => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [sheets, setSheets] = React.useState<Sheet[] | null>(null);
  const [sheetIndex, setSheetIndex] = React.useState(0);
  const [headerRow, setHeaderRow] = React.useState(0);
  const [mapping, setMapping] = React.useState<Mapping>({});
  const [remembered, setRemembered] = React.useState(false);
  const [readError, setReadError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [building, setBuilding] = React.useState(false);
  const [done, setDone] = React.useState<ConvertedSheet | null>(null);
  const { index } = useCategoryIndex();

  const categories = React.useMemo(() => [...index.values()], [index]);
  const leafCategories = React.useMemo(() => categories.filter((c) => c.isLeaf).sort((a, b) => a.path.join(" › ").localeCompare(b.path.join(" › "))), [categories]);
  // Listings go in a specific (leaf) category, so only those are matched; a parent name is flagged for the seller.
  const matchCategory = React.useMemo(() => (leafCategories.length ? createCategoryMatcher(leafCategories) : null), [leafCategories]);
  const resolveCategory = React.useCallback(
    (value: string) => {
      if (GUID.test(value)) return value;
      const m = matchCategory?.(value);
      return m?.ok ? m.value.categoryId : null;
    },
    [matchCategory],
  );

  const rows: Cell[][] = sheets?.[sheetIndex]?.rows ?? [];
  const headers = React.useMemo(() => (sheets ? headersOf(rows, headerRow) : []), [sheets, rows, headerRow]);

  const applyHeaders = (sheetRows: Cell[][], hr: number) => {
    const h = headersOf(sheetRows, hr);
    const saved = loadSavedMapping(headerSignature(h));
    setMapping(saved ?? autoMap(h));
    setRemembered(!!saved);
  };

  const pick = async (files: File[]) => {
    const f = files[0];
    setReadError(null);
    setDone(null);
    onClear();
    if (!f) return;
    if (f.size > MAX_BYTES) return setReadError(`That file is ${formatBytes(f.size)}. The limit is 50 MB.`);
    setReading(true);
    try {
      const all = (await readSellerFile(f)).filter((s) => s.rows.some((r) => r?.some((c) => c !== null && c !== undefined && String(c).trim() !== "")));
      if (!all.length) throw new Error("This file has no data.");
      const first = Math.max(0, all.findIndex((s) => s.rows.length > 1));
      const hr = detectHeaderRow(all[first].rows);
      setFile(f);
      setSheets(all);
      setSheetIndex(first);
      setHeaderRow(hr);
      applyHeaders(all[first].rows, hr);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "This file couldn't be read.");
      setFile(null);
      setSheets(null);
    } finally {
      setReading(false);
    }
  };

  const converted: ConvertedRow[] = React.useMemo(() => (sheets ? convert(rows, headerRow, mapping, { resolveCategory }) : []), [sheets, rows, headerRow, mapping, resolveCategory]);
  const incomplete = converted.filter((r) => r.missing.length > 0);
  const withNotes = converted.filter((r) => r.notes.length > 0);
  const missingFields = TARGETS.filter((t) => t.required && (mapping[t.key]?.kind ?? "none") === "none");

  const setField = (key: string, src: FieldSource) => {
    setDone(null);
    onClear();
    setMapping((m) => ({ ...m, [key]: src }));
  };

  const acceptRows = async () => {
    setBuilding(true);
    try {
      const out = await writeTemplate(converted);
      saveMapping(headerSignature(headers), mapping);
      const result = { file: out, sourceName: file?.name ?? "", rows: converted.length };
      setDone(result);
      onReady(result);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "The converted file couldn't be created.");
    } finally {
      setBuilding(false);
    }
  };

  if (!sheets) {
    return (
      <div className="space-y-2">
        <DropZone
          id="own-sheet"
          label="Your spreadsheet"
          hint="Any Excel (.xlsx) or CSV with one product per row, e.g. your stock list. Up to 50 MB."
          accept=".xlsx,.csv"
          icon={FileXlsIcon}
          buttonLabel="Choose your file"
          onFiles={(f) => void pick(f)}
          filter={false}
          disabled={disabled || reading}
        />
        {reading && <Skeleton className="h-10 w-full" />}
        {readError && (
          <p className="text-sm text-danger" role="alert">
            {readError}
          </p>
        )}
      </div>
    );
  }

  const sample = (col: number) => {
    for (let r = headerRow + 1; r < Math.min(rows.length, headerRow + 30); r++) {
      const v = rows[r]?.[col];
      if (v !== null && v !== undefined && String(v).trim()) return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim().slice(0, 30);
    }
    return "";
  };
  const valueOf = (src: FieldSource | undefined) => (!src || src.kind === "none" ? "none" : src.kind === "auto" ? "auto" : src.kind === "fixed" ? "fixed" : `col:${src.col}`);
  const categoryName = (v: string | number) => (typeof v === "string" && index.get(v) ? index.get(v)!.path.join(" › ") : String(v));

  const renderField = (t: (typeof TARGETS)[number]) => {
    const src = mapping[t.key];
    return (
      <li key={t.key} className="grid items-center gap-2 p-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <span className="text-sm font-medium text-foreground">
          {t.label}
          {t.required && <span className="text-danger"> *</span>}
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          <NativeSelect
            aria-label={`Source for ${t.label}`}
            value={valueOf(src)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "none") setField(t.key, { kind: "none" });
              else if (v === "auto") setField(t.key, { kind: "auto" });
              else if (v === "fixed") setField(t.key, { kind: "fixed", value: src?.kind === "fixed" ? src.value : (t.defaultFixed ?? "") });
              else setField(t.key, { kind: "column", col: Number(v.slice(4)) });
            }}
          >
            <option value="none">{t.required ? "— Choose —" : "Not in my file"}</option>
            {t.key === "sku" && <option value="auto">Generate automatically</option>}
            <option value="fixed">Same for every row…</option>
            {headers.map((h, i) => (
              <option key={i} value={`col:${i}`}>
                {`${columnLetter(i)} · ${h}${sample(i) ? ` (e.g. ${sample(i)})` : ""}`}
              </option>
            ))}
          </NativeSelect>
          {src?.kind === "fixed" &&
            (t.key === "category" ? (
              <NativeSelect aria-label={`${t.label} for every row`} value={src.value} onChange={(e) => setField(t.key, { kind: "fixed", value: e.target.value })}>
                <option value="">Choose a category…</option>
                {leafCategories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.path.join(" › ")}
                  </option>
                ))}
              </NativeSelect>
            ) : t.key === "pricingMode" ? (
              <NativeSelect aria-label={`${t.label} for every row`} value={src.value} onChange={(e) => setField(t.key, { kind: "fixed", value: e.target.value })}>
                {PRICING_MODES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input
                aria-label={`${t.label} for every row`}
                placeholder={t.fixedHint ?? t.defaultFixed ?? ""}
                type={t.kind === "date" ? "date" : "text"}
                value={src.value}
                onChange={(e) => setField(t.key, { kind: "fixed", value: e.target.value })}
              />
            ))}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
        <FileXlsIcon className="size-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{file?.name}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            setSheets(null);
            setFile(null);
            setDone(null);
            onClear();
          }}
        >
          Choose another file
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sheets.length > 1 && (
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Sheet</span>
            <NativeSelect
              aria-label="Sheet"
              value={String(sheetIndex)}
              onChange={(e) => {
                const i = Number(e.target.value);
                const hr = detectHeaderRow(sheets[i].rows);
                setSheetIndex(i);
                setHeaderRow(hr);
                applyHeaders(sheets[i].rows, hr);
                setDone(null);
                onClear();
              }}
            >
              {sheets.map((s, i) => (
                <option key={s.name} value={String(i)}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Column headings are in row</span>
          <NativeSelect
            aria-label="Heading row"
            value={String(headerRow)}
            onChange={(e) => {
              const hr = Number(e.target.value);
              setHeaderRow(hr);
              applyHeaders(rows, hr);
              setDone(null);
              onClear();
            }}
          >
            {rows.slice(0, 15).map((r, i) => (
              <option key={i} value={String(i)}>
                {`Row ${i + 1}: ${(r ?? []).filter((c) => c !== null && c !== undefined && String(c).trim()).slice(0, 3).join(", ").slice(0, 60) || "(empty)"}`}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Match your columns</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {remembered ? "We used the matching you saved last time for this layout. " : "We matched what we could. "}
          Check each field; fields marked * are required. If a value is the same for every product (like the emirate), choose “Same for every row”.
        </p>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border" aria-label="Column matching">
          {TARGETS.filter((t) => !t.advanced).map((t) => renderField(t))}
        </ul>
        <details className="mt-2 rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-foreground">More fields (optional): pricing mode, currency, country, grade, expiry, cover image, attributes</summary>
          <ul className="divide-y divide-border border-t border-border" aria-label="More column matching">
            {TARGETS.filter((t) => t.advanced).map((t) => renderField(t))}
          </ul>
        </details>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Preview</h3>
        <p className="mt-0.5 text-xs text-muted-foreground" data-testid="mapping-counts">
          {formatNumber(converted.length)} products found · {formatNumber(converted.length - incomplete.length)} complete · {formatNumber(incomplete.length)} missing required values
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Row</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {converted.slice(0, 5).map((r) => (
                <tr key={r.sourceRow} className={r.missing.length ? "bg-warning-soft/40" : undefined}>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.sourceRow}</td>
                  <td className="px-3 py-2">{r.cells[0]}</td>
                  <td className="px-3 py-2">{r.cells[1] || <span className="text-danger">missing</span>}</td>
                  <td className="px-3 py-2">{r.cells[2] ? categoryName(r.cells[2]) : <span className="text-danger">missing</span>}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.cells[10]} {r.cells[11]}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.cells[5]} {r.cells[6]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {missingFields.length > 0 && (
          <Notice tone="warning" className="mt-3">
            Still to match: {missingFields.map((f) => f.label).join(", ")}.
          </Notice>
        )}
        {missingFields.length === 0 && incomplete.length > 0 && (
          <Notice tone="warning" className="mt-3">
            {formatNumber(incomplete.length)} {incomplete.length === 1 ? "row is" : "rows are"} missing a required value (e.g. row {incomplete[0].sourceRow}: {incomplete[0].missing.join(", ")}). They'll be listed as errors after upload; the other rows can still be imported.
          </Notice>
        )}
        {withNotes.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-soft-foreground">
            <WarningIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Row {withNotes[0].sourceRow}: {withNotes[0].notes[0]}
            {withNotes.length > 1 ? ` (and ${formatNumber(withNotes.length - 1)} more rows with notes)` : ""}. Fix it in your file, or choose one category for every row.
          </p>
        )}
      </div>

      {done ? (
        <p className="flex items-center gap-2 text-sm font-medium text-foreground" role="status">
          <CheckCircleIcon className="size-5 text-success" weight="fill" aria-hidden /> {formatNumber(done.rows)} products ready to upload.
        </p>
      ) : (
        <Button variant="secondary" onClick={() => void acceptRows()} disabled={disabled || building || !converted.length || missingFields.length > 0} loading={building}>
          Use these {formatNumber(converted.length)} products
        </Button>
      )}
      {readError && (
        <p className="text-sm text-danger" role="alert">
          {readError}
        </p>
      )}
    </div>
  );
}
