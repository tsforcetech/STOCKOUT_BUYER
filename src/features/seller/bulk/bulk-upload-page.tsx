import * as React from "react";
import { Link, useBlocker } from "react-router";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DownloadSimpleIcon, FileCsvIcon, ImagesIcon, PlayIcon, StopIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { cn } from "@/lib/utils/cn";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatBytes } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import { ListingAccessNotice, canManageListings } from "../components/listing-access-notice";
import { Notice } from "../components/notice";
import { Stepper } from "../components/stepper";
import { BackLink } from "../components/back-link";
import { errorCode, sellerErrorMessage } from "../lib/errors";
import { sellerKeys, taxonomyKeys, useActiveSeller, useCategoryIndex, useSellerAccount } from "../lib/queries";
import { DropZone } from "./drop-zone";
import { ProgressTable, type ProgressRow } from "./progress-table";
import { ReviewTable, type ReviewRow } from "./review-table";
import { checkImageFile, createCategoryMatcher, imageKey, MAX_BULK_ROWS, readSheet, validateRow, type BulkContext, type ParsedSheet, type RequirementsState } from "./rows";
import { runBulkCreate, type RunItem, type RunState } from "./runner";
import { TemplateStep } from "./template-step";

const STEPS = ["Download template", "Upload file", "Review", "Create"] as const;
const MAX_CSV_BYTES = 5 * 1024 * 1024;
type Filter = "all" | "valid" | "invalid";

function StepHeading({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 space-y-1">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action text-xs text-action-foreground">{n}</span>
        {title}
      </h2>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** File.text() with a FileReader fallback (older Safari, jsdom). */
function readText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsText(file);
  });
}

interface Run {
  phase: "running" | "finished";
  submit: boolean;
  rows: ProgressRow[];
}

export default function SellerBulkUploadPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const enabled = canManageListings(seller);
  const qc = useQueryClient();
  const account = useSellerAccount(sellerId);
  const { data: tree, index, error: treeError, refetch: refetchTree } = useCategoryIndex();

  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<ParsedSheet | null>(null);
  const [removed, setRemoved] = React.useState<ReadonlySet<string>>(() => new Set());
  const [images, setImages] = React.useState<ReadonlyMap<string, File>>(() => new Map());
  const [filter, setFilter] = React.useState<Filter>("all");
  const [submitAfter, setSubmitAfter] = React.useState(false);
  const [run, setRun] = React.useState<Run | null>(null);
  const controller = React.useRef<AbortController | null>(null);

  // ---- validation context (live category tree + per-category requirements) ----
  const matchCategory = React.useMemo(() => (tree ? createCategoryMatcher([...index.values()]) : null), [tree, index]);
  const records = React.useMemo(() => (sheet?.records ?? []).filter((r) => !removed.has(r.id)), [sheet, removed]);
  const categoryIds = React.useMemo(() => {
    if (!matchCategory) return [];
    const ids = new Set<string>();
    for (const r of records) {
      const m = r.values.category ? matchCategory(r.values.category) : null;
      if (m?.ok) ids.add(m.value.categoryId);
    }
    return [...ids];
  }, [records, matchCategory]);
  const requirementQueries = useQueries({
    queries: categoryIds.map((id) => ({
      queryKey: taxonomyKeys.requirements(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => sellerListingsService.listingRequirements(id, signal),
      staleTime: 5 * 60_000,
    })),
  });
  const requirementsById = new Map<string, RequirementsState>();
  categoryIds.forEach((id, i) => {
    const q = requirementQueries[i];
    requirementsById.set(
      id,
      q.data ? { state: "ready", data: q.data } : q.error ? { state: "error", message: errorCode(q.error) === "CATEGORY_INACTIVE" ? "this category is inactive." : sellerErrorMessage(q.error) } : { state: "loading" },
    );
  });
  const ctx: BulkContext = {
    matchCategory,
    requirements: (id) => requirementsById.get(id) ?? { state: "loading" },
    images,
    defaultCurrency: account.data?.defaultCurrency ?? null,
  };
  const reviewRows: ReviewRow[] = records.map((record) => ({ record, check: validateRow(record, ctx) }));
  const valid = reviewRows.filter((r) => r.check.state === "valid");
  const invalidCount = reviewRows.filter((r) => r.check.state === "invalid").length;
  const checkingCount = reviewRows.filter((r) => r.check.state === "checking").length;
  const validWithoutImage = valid.filter((r) => !r.check.image).length;
  const shownRows = filter === "all" ? reviewRows : reviewRows.filter((r) => (filter === "valid" ? r.check.state === "valid" : r.check.state !== "valid"));
  const failedRequirements = requirementQueries.filter((q) => q.error);

  const referenced = new Map<string, number>();
  for (const r of records) if (r.values.image_file) referenced.set(imageKey(r.values.image_file), (referenced.get(imageKey(r.values.image_file)) ?? 0) + 1);

  // ---- leaving while a run is in progress ----
  const running = run?.phase === "running";
  const blocker = useBlocker(running);
  React.useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);
  React.useEffect(() => () => controller.current?.abort(), []);

  // ---- handlers ----
  const loadCsv = async (file: File) => {
    setFileError(null);
    const lower = file.name.toLowerCase();
    if (/\.(xlsx|xlsm|xls|ods|numbers)$/.test(lower)) {
      setFileError("Spreadsheet files can't be read directly. In Excel use File › Save As › “CSV UTF-8 (Comma delimited)”, or in Google Sheets File › Download › CSV, then upload that file.");
      return;
    }
    if (!lower.endsWith(".csv") && !lower.endsWith(".txt") && file.type !== "text/csv") {
      setFileError(`"${file.name}" isn't a CSV file. Upload a .csv file made from the template.`);
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setFileError(`"${file.name}" is larger than ${formatBytes(MAX_CSV_BYTES)}. Files hold up to ${MAX_BULK_ROWS} listings — split it up.`);
      return;
    }
    let text: string;
    try {
      text = await readText(file);
    } catch {
      setFileError(`"${file.name}" couldn't be read. Try saving it again.`);
      return;
    }
    const parsed = readSheet(text);
    setFileName(file.name);
    setSheet(parsed);
    setRemoved(new Set());
    setFilter("all");
  };

  const addImages = (files: File[]) =>
    setImages((prev) => {
      const next = new Map(prev);
      for (const f of files) next.set(imageKey(f.name), f);
      return next;
    });
  const removeImage = (key: string) =>
    setImages((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

  const reset = () => {
    setRun(null);
    setSheet(null);
    setFileName(null);
    setFileError(null);
    setRemoved(new Set());
    setImages(new Map());
    setSubmitAfter(false);
  };

  const start = async () => {
    const items: Array<RunItem & { line: number }> = valid.flatMap(({ record, check }) =>
      check.draft && check.quantity !== undefined ? [{ id: record.id, line: record.line, draft: check.draft, quantity: check.quantity, image: check.image ?? null }] : [],
    );
    if (!items.length) return;
    const ac = new AbortController();
    controller.current = ac;
    setRun({ phase: "running", submit: submitAfter, rows: items.map((i) => ({ id: i.id, line: i.line, title: i.draft.title, state: { status: "pending" } })) });
    const results = new Map<string, RunState>();
    await runBulkCreate({
      sellerId,
      items,
      submit: submitAfter,
      signal: ac.signal,
      onUpdate: (id, state) => {
        results.set(id, state);
        setRun((prev) => prev && { ...prev, rows: prev.rows.map((r) => (r.id === id ? { ...r, state } : r)) });
      },
    });
    setRun((prev) => prev && { ...prev, phase: "finished" });
    void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId) });
    if (ac.signal.aborted) return;
    const done = [...results.values()].filter((s) => s.status === "done").length;
    const failed = [...results.values()].filter((s) => s.status === "failed").length;
    if (failed) toast.error(`${done} of ${items.length} listings created, ${failed} failed.`);
    else toast.success(`${done} ${done === 1 ? "listing" : "listings"} created.`);
  };

  const cancel = () => controller.current?.abort();

  // ---- render ----
  const header = (
    <>
      <BackLink to="/seller/listings">All listings</BackLink>
      <PageHeader
      eyebrow="Seller portal"
      title="Bulk upload"
        description="Create many draft listings at once from a CSV file — with stock and a photo for each."
      />
      <Notice tone="info" className="mb-4" title="There's a new way to import">
        <Link to="/seller/listings/import" className="underline underline-offset-4">Bulk import</Link> checks your whole Excel file and ZIP of photos on the server and creates the drafts for you. This older CSV uploader stays available for now.
      </Notice>
    </>
  );

  if (!enabled) {
    return (
      <>
        {header}
        <ListingAccessNotice seller={seller} />
      </>
    );
  }

  const step = run ? 4 : records.length ? 3 : sheet || fileName ? 2 : 1;

  return (
    <>
      {header}
      <Stepper steps={STEPS} current={step} />

      {run ? (
        <RunPanel run={run} onCancel={cancel} onReset={reset} />
      ) : (
        <div className="space-y-4">
          <SectionCard>
            <StepHeading n={1} title="Download the template">
              Fill in one listing per row. CSV only — if you work in Excel or Google Sheets, export the sheet as CSV.
            </StepHeading>
            <TemplateStep />
          </SectionCard>

          <SectionCard>
            <StepHeading n={2} title="Upload your file">
              Add the CSV file, then the photos it names in the image_file column. Nothing is created until you confirm in step 4.
            </StepHeading>
            <div className="grid gap-4 md:grid-cols-2">
              <DropZone
                id="bulk-csv"
                label="Listings file (.csv)"
                hint={`Drag the CSV here or choose it. Up to ${MAX_BULK_ROWS} rows.`}
                accept=".csv,text/csv"
                filter={false}
                icon={FileCsvIcon}
                buttonLabel={fileName ? "Choose another file" : "Choose CSV file"}
                onFiles={(files) => void loadCsv(files[0])}
              >
                {fileName && (
                  <p className="max-w-full break-all text-xs text-foreground">
                    <span className="font-medium">{fileName}</span>
                    {sheet && !sheet.errors.length && ` · ${sheet.records.length} ${sheet.records.length === 1 ? "row" : "rows"}`}
                  </p>
                )}
              </DropZone>
              <DropZone
                id="bulk-images"
                label="Photos (optional)"
                hint="JPG, PNG or WebP, up to 10 MB each. Select several at once."
                accept="image/jpeg,image/png,image/webp"
                multiple
                icon={ImagesIcon}
                buttonLabel="Choose photos"
                onFiles={addImages}
              />
            </div>
            {fileError && <Notice tone="danger" className="mt-4" title="This file can't be used">{fileError}</Notice>}
            {sheet?.errors.length ? (
              <Notice tone="danger" className="mt-4" title="This file can't be used">
                <ul className="list-disc space-y-0.5 pl-4">
                  {sheet.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            {sheet?.warnings.map((w) => (
              <Notice key={w} tone="warning" className="mt-4">
                {w}
              </Notice>
            ))}
            {images.size > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {images.size} {images.size === 1 ? "photo" : "photos"} added
                </p>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[...images.entries()].map(([key, f]) => {
                    const problem = checkImageFile(f);
                    const uses = referenced.get(key) ?? 0;
                    return (
                      <li key={key} className={cn("group relative overflow-hidden rounded-lg border bg-surface", problem ? "border-danger/40" : "border-border")}>
                        <LocalThumb file={f} className="aspect-[4/3] w-full" />
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => removeImage(key)}
                        >
                          <XIcon className="size-3.5" />
                        </button>
                        <div className="space-y-0.5 px-2 py-1.5 text-xs">
                          <p className="truncate font-medium text-foreground" title={f.name}>
                            {f.name}
                          </p>
                          {problem ? (
                            <p className="text-danger-soft-foreground">{problem}</p>
                          ) : (
                            <p className="text-muted-foreground">
                              {formatBytes(f.size)}
                              {records.length > 0 && (uses ? ` · used ${uses}×` : " · not used")}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </SectionCard>

          {records.length > 0 && (
            <>
              <SectionCard>
                <StepHeading n={3} title="Review">
                  Each row is checked against the live categories, units and conditions. Fix errors in your file and upload it again, or remove rows you don't want.
                </StepHeading>
                {treeError && (
                  <Notice tone="danger" className="mb-4" title="Couldn't load the categories" action={<Button variant="secondary" size="sm" onClick={() => void refetchTree()}>Try again</Button>}>
                    {sellerErrorMessage(treeError)}
                  </Notice>
                )}
                {failedRequirements.length > 0 && (
                  <Notice
                    tone="danger"
                    className="mb-4"
                    title="Some category options couldn't be loaded"
                    action={
                      <Button variant="secondary" size="sm" onClick={() => failedRequirements.forEach((q) => void q.refetch())}>
                        Try again
                      </Button>
                    }
                  >
                    Rows in those categories are marked with an error until their units and conditions load.
                  </Notice>
                )}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-body" aria-live="polite" data-testid="review-counts">
                    <strong>{reviewRows.length}</strong> {reviewRows.length === 1 ? "row" : "rows"} · <span className="text-success-soft-foreground">{valid.length} valid</span> ·{" "}
                    <span className={invalidCount ? "text-danger-soft-foreground" : undefined}>{invalidCount} with errors</span>
                    {checkingCount > 0 && ` · ${checkingCount} checking`}
                    {removed.size > 0 && ` · ${removed.size} removed`}
                  </p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show rows">
                    {(["all", "valid", "invalid"] as const).map((f) => (
                      <Button key={f} size="sm" variant={filter === f ? "action" : "secondary"} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                        {f === "all" ? "All" : f === "valid" ? "Valid" : "Needs attention"}
                      </Button>
                    ))}
                  </div>
                </div>
                {shownRows.length ? (
                  <ReviewTable rows={shownRows} onRemove={(id) => setRemoved((prev) => new Set(prev).add(id))} />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No rows in this view.</p>
                )}
              </SectionCard>

              <SectionCard>
                <StepHeading n={4} title="Create listings">
                  Listings are created one at a time as private drafts with their stock and photo. You can stop at any point; finished rows are kept.
                </StepHeading>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox id="bulk-submit" checked={submitAfter} onCheckedChange={(v) => setSubmitAfter(v === true)} className="mt-0.5" />
                    <label htmlFor="bulk-submit" className="space-y-0.5 text-sm">
                      <span className="block font-medium text-foreground">Submit for review after creating</span>
                      <span className="block text-muted-foreground">The marketplace team reviews each listing before it goes live. Submitting needs at least one photo.</span>
                    </label>
                  </div>
                  {submitAfter && validWithoutImage > 0 && (
                    <Notice tone="warning">
                      {validWithoutImage} valid {validWithoutImage === 1 ? "row has" : "rows have"} no photo. {validWithoutImage === 1 ? "It" : "They"} will be created as {validWithoutImage === 1 ? "a draft" : "drafts"} but not submitted — add a photo in the editor and submit later.
                    </Notice>
                  )}
                  {invalidCount > 0 && valid.length > 0 && <p className="text-sm text-muted-foreground">{invalidCount} {invalidCount === 1 ? "row" : "rows"} with errors will be skipped.</p>}
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                    {checkingCount > 0 && <span className="text-sm text-muted-foreground">Still checking {checkingCount} {checkingCount === 1 ? "row" : "rows"}…</span>}
                    <Button variant="primary" disabled={!valid.length || checkingCount > 0} onClick={() => void start()}>
                      <PlayIcon /> Create {valid.length} {valid.length === 1 ? "listing" : "listings"}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Stop creating listings?"
        description="Listings already created stay as they are. Rows that haven't started yet won't be created."
        confirmLabel="Stop and leave"
        onConfirm={() => {
          controller.current?.abort();
          blocker.proceed?.();
        }}
      />
    </>
  );
}

function RunPanel({ run, onCancel, onReset }: { run: Run; onCancel: () => void; onReset: () => void }) {
  const count = (s: RunState["status"]) => run.rows.filter((r) => r.state.status === s).length;
  const done = count("done");
  const failed = count("failed");
  const cancelled = count("cancelled");
  const submitted = run.rows.filter((r) => r.state.submitted).length;
  const finishedRows = run.rows.length - count("pending") - count("creating");
  const running = run.phase === "running";

  const exportResults = () =>
    downloadCsv(
      "stockout-bulk-upload-results.csv",
      toCsv(run.rows, [
        { header: "row", value: (r) => r.line },
        { header: "title", value: (r) => r.title },
        { header: "status", value: (r) => (r.state.status === "done" ? (r.state.submitted ? "submitted" : "draft") : r.state.status) },
        { header: "listing_id", value: (r) => r.state.listingId ?? "" },
        { header: "message", value: (r) => r.state.error ?? r.state.note ?? "" },
      ]),
    );

  return (
    <div className="space-y-4">
      <SectionCard>
        <StepHeading n={4} title={running ? "Creating listings…" : "Finished"} />
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-body" data-testid="run-counts">
              {finishedRows} of {run.rows.length} processed · {done} created{run.submit && ` (${submitted} submitted)`} · {failed} failed
              {cancelled > 0 && ` · ${cancelled} cancelled`}
            </span>
            {running ? (
              <Button variant="secondary" size="sm" onClick={onCancel}>
                <StopIcon /> Stop after current step
              </Button>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted ring-1 ring-inset ring-border" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={run.rows.length} aria-valuenow={finishedRows}>
            <div className="h-full bg-action transition-[width]" style={{ width: `${run.rows.length ? (finishedRows / run.rows.length) * 100 : 0}%` }} />
          </div>
          {running && <p className="text-xs text-muted-foreground">Keep this page open. Requests are paced to stay within the marketplace's rate limits.</p>}
        </div>

        {!running && (
          <Notice tone={failed ? "warning" : "info"} className="mb-4" title={`${done} of ${run.rows.length} ${run.rows.length === 1 ? "listing" : "listings"} created${run.submit ? `, ${submitted} submitted for review` : ""}.`}>
            {failed > 0 && "Failed rows that already have a draft can be finished in the editor (“Fix in editor”). Rows that failed before a draft existed weren't created — fix them in your file and upload just those rows again. "}
            {cancelled > 0 && "You stopped the run; rows marked cancelled weren't finished. "}
            {done > 0 && !run.submit && "New listings are private drafts until you submit them for review."}
          </Notice>
        )}

        <ProgressTable rows={run.rows} />

        {!running && (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={exportResults}>
              <DownloadSimpleIcon /> Download results
            </Button>
            <Button variant="secondary" onClick={onReset}>
              Start a new upload
            </Button>
            <Button asChild variant="primary">
              <Link to="/seller/listings">Go to listings</Link>
            </Button>
          </div>
        )}
      </SectionCard>
      {!running && failed + cancelled > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          <Badge tone="neutral">Tip</Badge> Download the results to see which rows still need work.
        </p>
      )}
    </div>
  );
}

/** Preview of a photo picked on this device (object URL, revoked when the tile goes away). */
function LocalThumb({ file, className }: { file: File; className?: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [file]);
  return url ? <img src={url} alt="" className={cn("bg-surface-muted object-cover", className)} /> : <div className={cn("bg-surface-muted", className)} />;
}
