import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, CircleIcon, FileXlsIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import { useCategoryIndex } from "../lib/queries";
import { createCategoryMatcher } from "../bulk/rows";
import {
  TARGETS,
  autoMap,
  columnLetter,
  convert,
  detectHeaderRow,
  headerSignature,
  headersOf,
  loadSavedMapping,
  saveMapping,
  writeTemplate,
  type Cell,
  type ConvertedRow,
  type FieldSource,
  type Mapping,
  type Sheet,
} from "./mapping";

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
  /** True when the seller's file was already the StockOut template and is uploaded unchanged. */
  template?: boolean;
}

const filled = (c: Cell) => c !== null && c !== undefined && String(c).trim() !== "";

/**
 * Step 2 of bulk import: match the seller's columns to ours (or set one value for every row), with a live
 * summary beside it. "Continue" converts the rows into the StockOut template the server reads; nothing is
 * uploaded here, and the server still checks every row after upload.
 */
export function MatchStep({ file, sheets, onBack, onReady }: { file: File; sheets: Sheet[]; onBack: () => void; onReady: (result: ConvertedSheet) => void }) {
  const firstSheet = Math.max(0, sheets.findIndex((s) => s.rows.length > 1));
  const [sheetIndex, setSheetIndex] = React.useState(firstSheet);
  const [headerRow, setHeaderRow] = React.useState(() => detectHeaderRow(sheets[firstSheet].rows));
  const [mapping, setMapping] = React.useState<Mapping>({});
  const [remembered, setRemembered] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [building, setBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
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

  const rows: Cell[][] = sheets[sheetIndex]?.rows ?? [];
  const headers = React.useMemo(() => headersOf(rows, headerRow), [rows, headerRow]);

  // A layout seen before gets the seller's saved matching; otherwise our best guess.
  React.useEffect(() => {
    const saved = loadSavedMapping(headerSignature(headers));
    setMapping(saved ?? autoMap(headers));
    setRemembered(!!saved);
  }, [headers]);

  const converted: ConvertedRow[] = React.useMemo(() => convert(rows, headerRow, mapping, { resolveCategory }), [rows, headerRow, mapping, resolveCategory]);
  const incomplete = converted.filter((r) => r.missing.length > 0);
  const withNotes = converted.filter((r) => r.notes.length > 0);
  const required = TARGETS.filter((t) => t.required);
  const isSet = (key: string) => (mapping[key]?.kind ?? "none") !== "none" && !(mapping[key]?.kind === "fixed" && !(mapping[key] as { value: string }).value.trim());
  const missingFields = required.filter((t) => !isSet(t.key));
  const optional = TARGETS.filter((t) => !t.required);
  const optionalSet = optional.filter((t) => isSet(t.key)).length;

  const setField = (key: string, src: FieldSource) => setMapping((m) => ({ ...m, [key]: src }));

  const proceed = async () => {
    setBuilding(true);
    setError(null);
    try {
      const out = await writeTemplate(converted);
      saveMapping(headerSignature(headers), mapping);
      onReady({ file: out, sourceName: file.name, rows: converted.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The converted file couldn't be created.");
    } finally {
      setBuilding(false);
    }
  };

  const sample = (col: number) => {
    for (let r = headerRow + 1; r < Math.min(rows.length, headerRow + 30); r++) {
      const v = rows[r]?.[col];
      if (filled(v)) return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim().slice(0, 40);
    }
    return "";
  };
  const valueOf = (src: FieldSource | undefined) => (!src || src.kind === "none" ? "none" : src.kind === "auto" ? "auto" : src.kind === "fixed" ? "fixed" : `col:${src.col}`);
  const categoryName = (v: string | number) => (typeof v === "string" && index.get(v) ? index.get(v)!.path.join(" › ") : String(v));

  const renderField = (t: (typeof TARGETS)[number]) => {
    const src = mapping[t.key];
    const ok = isSet(t.key);
    const example = src?.kind === "column" ? sample(src.col) : "";
    return (
      <li key={t.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
        <span className="flex items-center gap-2 pt-2 text-sm font-medium text-foreground sm:w-44 sm:shrink-0">
          {ok ? (
            <CheckCircleIcon weight="fill" className="size-4 shrink-0 text-success" aria-hidden />
          ) : t.required ? (
            <WarningCircleIcon weight="fill" className="size-4 shrink-0 text-warning" aria-hidden />
          ) : (
            <CircleIcon className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
          )}
          {t.label}
          {t.required && <span className="sr-only"> (required)</span>}
        </span>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0">
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
              <option value="none">{t.required ? "Choose a column…" : "Not in my file"}</option>
              {t.key === "sku" && <option value="auto">Generate automatically</option>}
              <option value="fixed">Same for every row…</option>
              {headers.map((h, i) => (
                <option key={i} value={`col:${i}`}>
                  {`${columnLetter(i)} · ${h}`}
                </option>
              ))}
            </NativeSelect>
            {example && <p className="mt-1 truncate text-xs text-muted-foreground">e.g. {example}</p>}
          </div>
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

  const ready = converted.length - incomplete.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-4">
        <section className="rounded-2xl bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted ring-1 ring-border" aria-hidden>
              <FileXlsIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {sheets.length > 1 ? `Sheet “${sheets[sheetIndex].name}” · ` : ""}headings in row {headerRow + 1} · {headers.length} columns
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen}>
              {settingsOpen ? "Done" : "Change"}
            </Button>
          </div>
          {settingsOpen && (
            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              {sheets.length > 1 && (
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-foreground">Sheet</span>
                  <NativeSelect
                    aria-label="Sheet"
                    value={String(sheetIndex)}
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      setSheetIndex(i);
                      setHeaderRow(detectHeaderRow(sheets[i].rows));
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
                <NativeSelect aria-label="Heading row" value={String(headerRow)} onChange={(e) => setHeaderRow(Number(e.target.value))}>
                  {rows.slice(0, 15).map((r, i) => (
                    <option key={i} value={String(i)}>
                      {`Row ${i + 1}: ${(r ?? []).filter(filled).slice(0, 3).join(", ").slice(0, 60) || "(empty)"}`}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
            <h2 className="font-heading text-base font-bold text-foreground">Required</h2>
            <span className="text-xs text-muted-foreground">
              {required.length - missingFields.length} of {required.length} matched{remembered ? " · using your saved matching" : ""}
            </span>
          </header>
          <ul className="divide-y divide-border" aria-label="Column matching">
            {required.map(renderField)}
          </ul>
        </section>

        <details className="group overflow-hidden rounded-2xl bg-surface">
          <summary className="flex cursor-pointer select-none items-baseline justify-between gap-2 px-4 py-3 sm:px-5">
            <span className="font-heading text-base font-bold text-foreground">Optional details</span>
            <span className="text-xs text-muted-foreground">
              {optionalSet} of {optional.length} matched · brand, condition, location, photos…
            </span>
          </summary>
          <ul className="divide-y divide-border border-t border-border" aria-label="More column matching">
            {optional.map(renderField)}
          </ul>
        </details>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-[80px]" aria-label="Summary">
        <section className="rounded-2xl bg-surface p-4 sm:p-5">
          <h2 className="font-heading text-base font-bold text-foreground">Your products</h2>
          <p className="sr-only" data-testid="mapping-counts">
            {converted.length} products · {ready} ready · {incomplete.length} need attention
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Found", converted.length, "text-foreground"],
                ["Ready", ready, "text-success"],
                ["Need a fix", incomplete.length, incomplete.length ? "text-warning-soft-foreground" : "text-muted-foreground"],
              ] as const
            ).map(([label, n, tone]) => (
              <div key={label} className="rounded-lg bg-surface-muted px-2 py-2.5">
                <dd className={cn("font-heading text-xl font-bold tabular-nums", tone)}>{formatNumber(n)}</dd>
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>

          <ul className="mt-4 space-y-2" aria-label="Preview">
            {converted.slice(0, 4).map((r) => (
              <li key={r.sourceRow} className="flex items-start gap-2 text-xs">
                {r.missing.length ? (
                  <WarningCircleIcon weight="fill" className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="Needs a fix" />
                ) : (
                  <CheckCircleIcon weight="fill" className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Ready" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{r.cells[1] || `Row ${r.sourceRow}`}</span>
                  <span className="block truncate text-muted-foreground">
                    {r.missing.length
                      ? `Missing: ${r.missing.join(", ")}`
                      : [r.cells[2] ? categoryName(r.cells[2]) : "", `${r.cells[10]} ${r.cells[11]}`.trim(), `${r.cells[6]} ${r.cells[5]}`.trim()].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
            {converted.length > 4 && <li className="text-xs text-muted-foreground">+ {formatNumber(converted.length - 4)} more</li>}
          </ul>

          {missingFields.length > 0 ? (
            <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground" role="status">
              Still to match: {missingFields.map((f) => f.label).join(", ")}.
            </p>
          ) : incomplete.length > 0 ? (
            <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
              {formatNumber(incomplete.length)} {incomplete.length === 1 ? "row is" : "rows are"} missing a value (e.g. row {incomplete[0].sourceRow}: {incomplete[0].missing.join(", ")}). You can still continue — those rows are skipped.
            </p>
          ) : null}
          {withNotes.length > 0 && (
            <p className="mt-2 text-xs text-warning-soft-foreground">
              Row {withNotes[0].sourceRow}: {withNotes[0].notes[0]}
              {withNotes.length > 1 ? ` (+${formatNumber(withNotes.length - 1)} more)` : ""}. Fix it in your file, or set one category for every row.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={onBack} aria-label="Back to file">
              <ArrowLeftIcon />
            </Button>
            <Button className="flex-1" onClick={() => void proceed()} disabled={building || !converted.length || missingFields.length > 0} loading={building}>
              Continue with {formatNumber(converted.length)} <ArrowRightIcon />
            </Button>
          </div>
        </section>
      </aside>
    </div>
  );
}
