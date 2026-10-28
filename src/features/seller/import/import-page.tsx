import * as React from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CircleIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  FileXlsIcon,
  FileZipIcon,
  ListChecksIcon,
  RowsIcon,
  TableIcon,
  UploadSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/utils/format";
import { bulkImportService } from "@/services/bulk-import.service";
import { BULK_MAX_EXCEL_BYTES, BULK_MAX_ZIP_BYTES } from "@/api/types/bulk-import";
import { ListingAccessNotice, canManageListings } from "../components/listing-access-notice";
import { Notice } from "../components/notice";
import { BackLink } from "../components/back-link";
import { Stepper } from "../components/stepper";
import { useActiveSeller } from "../lib/queries";
import { DropZone } from "../bulk/drop-zone";
import { IMPORT_STEPS, importErrorMessage, importKeys, isUncertain, saveBlob, statusLabel } from "./shared";
import { MatchStep, type ConvertedSheet } from "./own-sheet-mapper";
import { readSellerFile, templateRowCount, type Sheet } from "./mapping";

type Stage = "create" | "excel" | "zip" | "validate";

/**
 * E2 seller bulk import in three steps: (1) drop any Excel/CSV — the StockOut template is recognised and skips
 * matching; (2) match the seller's columns to ours; (3) add an optional ZIP of photos, upload and check.
 * Reviewing and confirming the checked rows happens on /seller/listings/import/:jobId.
 */
export default function SellerImportPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const enabled = canManageListings(seller);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [source, setSource] = React.useState<{ file: File; sheets: Sheet[] } | null>(null);
  const [ready, setReady] = React.useState<ConvertedSheet | null>(null);
  const [zip, setZip] = React.useState<File | null>(null);
  const [reading, setReading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [zipError, setZipError] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<Stage | null>(null);
  const [doneStages, setDoneStages] = React.useState<Stage[]>([]);
  const [error, setError] = React.useState<{ message: string; jobId?: string } | null>(null);
  const [templateState, setTemplateState] = React.useState<"idle" | "loading">("idle");
  const [templateError, setTemplateError] = React.useState<string | null>(null);
  const jobs = useQuery({ queryKey: importKeys.list(sellerId, 1), queryFn: ({ signal }) => bulkImportService.list(sellerId, 1, 20, signal), enabled });

  const pickFile = async (files: File[]) => {
    const f = files[0];
    setFileError(null);
    if (!f) return;
    if (!/\.(xlsx|csv)$/i.test(f.name)) return setFileError("Choose an Excel (.xlsx) or CSV file. Older .xls files: open them in Excel and save as .xlsx.");
    if (f.size === 0) return setFileError("That file is empty.");
    if (f.size > BULK_MAX_EXCEL_BYTES) return setFileError(`That file is ${formatBytes(f.size)}. The limit is 50 MB.`);
    setReading(true);
    try {
      const sheets = (await readSellerFile(f)).filter((s) => s.rows.some((r) => r?.some((c) => c !== null && c !== undefined && String(c).trim() !== "")));
      if (!sheets.length) throw new Error("This file has no data.");
      const templateRows = /\.xlsx$/i.test(f.name) ? templateRowCount(sheets) : null;
      setSource({ file: f, sheets });
      if (templateRows !== null) {
        if (templateRows === 0) throw new Error("The Products sheet of this template has no products yet.");
        setReady({ file: f, sourceName: f.name, rows: templateRows, template: true });
        setStep(3);
      } else {
        setReady(null);
        setStep(2);
      }
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "This file couldn't be read.");
    } finally {
      setReading(false);
    }
  };

  const pickZip = (files: File[]) => {
    const f = files[0];
    setZipError(null);
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) return setZipError("Product photos must be in a single .zip file.");
    if (f.size === 0) return setZipError("That ZIP file is empty.");
    if (f.size > BULK_MAX_ZIP_BYTES) return setZipError(`That ZIP is ${formatBytes(f.size)}. The limit is 100 MB.`);
    setZip(f);
  };

  const downloadTemplate = async () => {
    setTemplateError(null);
    setTemplateState("loading");
    try {
      saveBlob(await bulkImportService.template(sellerId), "stockout_bulk_product_import_template_v1.xlsx");
    } catch (e) {
      setTemplateError(importErrorMessage(e));
    } finally {
      setTemplateState("idle");
    }
  };

  const restart = () => {
    setStep(1);
    setSource(null);
    setReady(null);
    setError(null);
  };

  const start = async () => {
    if (!ready) return;
    setError(null);
    setDoneStages([]);
    let jobId: string | undefined;
    // Tracked outside React state: the catch below must see the step that failed, not the render-time value.
    const at: { step: Stage } = { step: "create" };
    const go = (next: Stage) => {
      setDoneStages((d) => [...d, at.step]);
      at.step = next;
      setStage(next);
    };
    try {
      setStage("create");
      jobId = (await bulkImportService.create(sellerId)).jobId;
      go("excel");
      await bulkImportService.uploadExcel(sellerId, jobId, ready.file);
      if (zip) {
        go("zip");
        await bulkImportService.uploadZip(sellerId, jobId, zip);
      }
      go("validate");
      await bulkImportService.validate(sellerId, jobId);
      void qc.invalidateQueries({ queryKey: importKeys.all(sellerId) });
      navigate(`/seller/listings/import/${jobId}`);
    } catch (e) {
      void qc.invalidateQueries({ queryKey: importKeys.all(sellerId) });
      // A lost connection during validation may still finish on the server: send the seller to the job to see.
      if (jobId && at.step === "validate" && isUncertain(e)) {
        navigate(`/seller/listings/import/${jobId}`);
        return;
      }
      setError({ message: importErrorMessage(e), jobId });
    } finally {
      setStage(null);
    }
  };

  const busy = stage !== null;
  const progress: Array<[Stage, string]> = [
    ["create", "Starting the import"],
    ["excel", "Uploading your list"],
    ...(zip ? [["zip", "Uploading photos"] as [Stage, string]] : []),
    ["validate", "Checking every row"],
  ];

  return (
    <div className="space-y-4">
      <BackLink to="/seller/listings">Listings</BackLink>
      <PageHeader title="Bulk import" description="Add many products at once from the stock list you already have." />
      {!enabled ? (
        <ListingAccessNotice seller={seller} />
      ) : (
        <>
          <Stepper steps={IMPORT_STEPS} current={step} />

          {step === 1 && (
            <>
              <SectionCard>
                <DropZone
                  id="import-file"
                  label="Upload your product list"
                  hint="Excel (.xlsx) or CSV with one product per row — your own stock list is fine. Up to 50 MB."
                  accept=".xlsx,.csv"
                  icon={FileXlsIcon}
                  buttonLabel="Choose file"
                  onFiles={(f) => void pickFile(f)}
                  filter={false}
                  disabled={reading}
                />
                {reading && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <CircleNotchIcon className="size-4 animate-spin" aria-hidden /> Reading your file…
                  </p>
                )}
                {fileError && (
                  <p className="mt-3 text-sm text-danger" role="alert">
                    {fileError}
                  </p>
                )}

                <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      [TableIcon, "Upload your list", "Any layout. Extra columns are ignored."],
                      [RowsIcon, "Match columns", "Tell us which column is the price, quantity… We remember it next time."],
                      [ListChecksIcon, "Check and import", "We check every row first. Products are created as drafts."],
                    ] as const
                  ).map(([Icon, title, text], i) => (
                    <li key={title} className="flex gap-3 rounded-xl bg-surface-muted p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface ring-1 ring-border" aria-hidden>
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {i + 1}. {title}
                        </span>
                        <span className="text-xs text-muted-foreground">{text}</span>
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
                  <span>Starting from scratch?</span>
                  <Button variant="ghost" size="sm" onClick={() => void downloadTemplate()} loading={templateState === "loading"}>
                    <DownloadSimpleIcon /> Download the StockOut template
                  </Button>
                  <span className="text-xs">— a filled-in template skips the matching step.</span>
                  {templateError && (
                    <p className="w-full text-sm text-danger" role="alert">
                      {templateError}
                    </p>
                  )}
                </div>
              </SectionCard>

              <RecentImports jobs={jobs} />
            </>
          )}

          {step === 2 && source && (
            <MatchStep
              file={source.file}
              sheets={source.sheets}
              onBack={restart}
              onReady={(r) => {
                setReady(r);
                setStep(3);
              }}
            />
          )}

          {step === 3 && ready && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <SectionCard>
                <h2 className="font-heading text-lg font-bold text-foreground">Product photos</h2>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">
                  Optional. Put all photos in one ZIP and use their file names in your list's image column (for example <code className="rounded bg-surface-muted px-1">valve-01.jpg</code>). You can also add photos to each draft later.
                </p>
                {zip ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                    <FileZipIcon className="size-5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{zip.name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(zip.size)}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setZip(null)} disabled={busy} aria-label={`Remove ${zip.name}`}>
                      <XIcon />
                    </Button>
                  </div>
                ) : (
                  <DropZone id="import-zip" label="Product photos (optional)" hint="One .zip up to 100 MB" accept=".zip" icon={FileZipIcon} buttonLabel="Choose ZIP" onFiles={pickZip} filter={false} disabled={busy} />
                )}
                {zipError && (
                  <p className="mt-3 text-sm text-danger" role="alert">
                    {zipError}
                  </p>
                )}
              </SectionCard>

              <aside className="space-y-4 lg:sticky lg:top-[80px]" aria-label="Summary">
                <SectionCard>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted ring-1 ring-border" aria-hidden>
                      <FileXlsIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-xl font-bold text-foreground">{formatNumber(ready.rows)} products</p>
                      <p className="truncate text-xs text-muted-foreground">{ready.sourceName}</p>
                    </div>
                  </div>
                  {ready.template && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
                      <CheckCircleIcon weight="fill" className="size-4" aria-hidden /> StockOut template recognised — no matching needed.
                    </p>
                  )}

                  {busy ? (
                    <ul className="mt-4 space-y-2" aria-live="polite" aria-label="Import progress">
                      {progress.map(([s, label]) => {
                        const done = doneStages.includes(s);
                        const active = stage === s;
                        return (
                          <li key={s} className={cn("flex items-center gap-2 text-sm", done || active ? "text-foreground" : "text-muted-foreground")}>
                            {done ? (
                              <CheckCircleIcon weight="fill" className="size-4 text-success" aria-hidden />
                            ) : active ? (
                              <CircleNotchIcon className="size-4 animate-spin" aria-hidden />
                            ) : (
                              <CircleIcon className="size-4" aria-hidden />
                            )}
                            {label}
                            {active ? "…" : ""}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground">Next we check every row and show you what's ready and what needs a fix. Nothing is created until you confirm, and products start as drafts.</p>
                  )}

                  {error && (
                    <Notice
                      tone="danger"
                      className="mt-4"
                      title="The import couldn't start"
                      action={
                        error.jobId ? (
                          <Link to={`/seller/listings/import/${error.jobId}`} className="text-sm underline underline-offset-4">
                            Open this import
                          </Link>
                        ) : undefined
                      }
                    >
                      {error.message}
                    </Notice>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" onClick={() => (ready.template ? restart() : setStep(2))} disabled={busy} aria-label={ready.template ? "Back to file" : "Back to matching"}>
                      <ArrowLeftIcon />
                    </Button>
                    <Button className="flex-1" onClick={() => void start()} disabled={busy} loading={busy}>
                      <UploadSimpleIcon /> Upload and check
                    </Button>
                  </div>
                </SectionCard>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecentImports({ jobs }: { jobs: UseQueryResult<Awaited<ReturnType<typeof bulkImportService.list>>> }) {
  return (
    <SectionCard>
      <h2 className="font-heading text-lg font-bold text-foreground">Recent imports</h2>
      {jobs.isLoading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : jobs.error ? (
        <Notice
          tone="danger"
          className="mt-3"
          action={
            <Button size="sm" variant="secondary" onClick={() => void jobs.refetch()}>
              Try again
            </Button>
          }
        >
          {importErrorMessage(jobs.error)}
        </Notice>
      ) : !jobs.data?.items.length ? (
        <p className="mt-3 text-sm text-muted-foreground">No imports yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border" aria-label="Recent imports">
          {jobs.data.items.map((j) => {
            const s = statusLabel(j.status);
            return (
              <li key={j.jobId}>
                <Link to={`/seller/listings/import/${j.jobId}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-muted">
                  <FileXlsIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{j.originalFileName ?? "No spreadsheet uploaded"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(j.createdAtUtc)} · {formatNumber(j.totalRows)} rows · {formatNumber(j.createdDraftsCount)} drafts
                    </span>
                  </span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
