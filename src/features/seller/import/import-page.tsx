import * as React from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadSimpleIcon, FileXlsIcon, FileZipIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/utils/format";
import { bulkImportService } from "@/services/bulk-import.service";
import { BULK_MAX_EXCEL_BYTES, BULK_MAX_ZIP_BYTES } from "@/api/types/bulk-import";
import { ListingAccessNotice, canManageListings } from "../components/listing-access-notice";
import { Notice } from "../components/notice";
import { BackLink } from "../components/back-link";
import { useActiveSeller } from "../lib/queries";
import { DropZone } from "../bulk/drop-zone";
import { importErrorMessage, importKeys, isUncertain, saveBlob, statusLabel } from "./shared";
import { OwnSheetMapper, type ConvertedSheet } from "./own-sheet-mapper";

/**
 * E2 seller bulk import, step 1: download the server's template, pick the filled .xlsx (and an optional .zip of
 * images), then upload and check them. Everything after that happens on /seller/listings/import/:jobId.
 */
export default function SellerImportPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const enabled = canManageListings(seller);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [excel, setExcel] = React.useState<File | null>(null);
  // "own": the seller's own sheet, matched and converted in the browser; "template": the StockOut template as-is.
  const [mode, setMode] = React.useState<"own" | "template">("own");
  const [converted, setConverted] = React.useState<ConvertedSheet | null>(null);
  const [zip, setZip] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<null | "create" | "excel" | "zip" | "validate">(null);
  const [error, setError] = React.useState<{ message: string; jobId?: string } | null>(null);
  const [templateState, setTemplateState] = React.useState<"idle" | "loading">("idle");
  const [templateError, setTemplateError] = React.useState<string | null>(null);
  const jobs = useQuery({ queryKey: importKeys.list(sellerId, 1), queryFn: ({ signal }) => bulkImportService.list(sellerId, 1, 20, signal), enabled });

  const pickExcel = (files: File[]) => {
    const f = files[0];
    setFileError(null);
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return setFileError("Choose the filled-in template as an Excel (.xlsx) file.");
    if (f.size === 0) return setFileError("That spreadsheet is empty.");
    if (f.size > BULK_MAX_EXCEL_BYTES) return setFileError(`That spreadsheet is ${formatBytes(f.size)}. The limit is 50 MB.`);
    setExcel(f);
  };
  const pickZip = (files: File[]) => {
    const f = files[0];
    setFileError(null);
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) return setFileError("Product images must be in a single .zip file.");
    if (f.size === 0) return setFileError("That ZIP file is empty.");
    if (f.size > BULK_MAX_ZIP_BYTES) return setFileError(`That ZIP is ${formatBytes(f.size)}. The limit is 100 MB.`);
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

  const start = async () => {
    if (!excel) return;
    setError(null);
    let jobId: string | undefined;
    // Tracked outside React state: the catch below must see the step that failed, not the render-time value.
    const at: { step: NonNullable<typeof stage> } = { step: "create" };
    const go = (next: NonNullable<typeof stage>) => {
      at.step = next;
      setStage(next);
    };
    try {
      go("create");
      jobId = (await bulkImportService.create(sellerId)).jobId;
      go("excel");
      await bulkImportService.uploadExcel(sellerId, jobId, excel);
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
  const stageText = { create: "Starting import…", excel: "Uploading spreadsheet…", zip: "Uploading images…", validate: "Checking every row…" } as const;

  return (
    <div className="space-y-4">
      <BackLink to="/seller/listings">Listings</BackLink>
      <PageHeader title="Bulk import" description="Create many listing drafts at once from your own Excel or CSV, or from the StockOut template, with an optional ZIP of product photos." />
      {!enabled ? (
        <ListingAccessNotice seller={seller} />
      ) : (
        <>
          <SectionCard>
            <h2 className="font-heading text-lg font-bold text-foreground">1. Your product list</h2>
            <fieldset className="mt-3 grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">How do you want to import?</legend>
              {(
                [
                  ["own", "Use my own Excel or CSV", "Upload the stock list you already have. You match its columns to ours once; we remember it next time."],
                  ["template", "Use the StockOut template", "Download our template, fill it in, and upload it."],
                ] as const
              ).map(([value, title, desc]) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-ink has-[:checked]:bg-surface-muted">
                  <input
                    type="radio"
                    name="import-mode"
                    value={value}
                    checked={mode === value}
                    disabled={busy}
                    className="mt-1 accent-[var(--ink)]"
                    onChange={() => {
                      setMode(value);
                      setExcel(null);
                      setConverted(null);
                      setFileError(null);
                    }}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{title}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="mt-5">
              {mode === "own" ? (
                <OwnSheetMapper
                  disabled={busy}
                  onReady={(r) => {
                    setConverted(r);
                    setExcel(r.file);
                  }}
                  onClear={() => {
                    setConverted(null);
                    setExcel(null);
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={() => void downloadTemplate()} loading={templateState === "loading"}>
                      <DownloadSimpleIcon /> Download template (.xlsx)
                    </Button>
                    {templateError && <p className="text-sm text-danger" role="alert">{templateError}</p>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fill in the <strong>Products</strong> sheet. The template lists the required columns and the allowed values. Reference each photo by its path inside your ZIP.
                  </p>
                  <FileSlot file={excel} onClear={() => setExcel(null)} disabled={busy}>
                    <DropZone id="import-excel" label="Filled-in template (required)" hint="The StockOut template, .xlsx up to 50 MB" accept=".xlsx" icon={FileXlsIcon} buttonLabel="Choose spreadsheet" onFiles={pickExcel} filter={false} disabled={busy} />
                  </FileSlot>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="font-heading text-lg font-bold text-foreground">2. Photos and upload</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">We check every row before anything is created. Nothing is listed until you confirm, and imported listings start as drafts.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FileSlot file={zip} onClear={() => setZip(null)} disabled={busy}>
                <DropZone id="import-zip" label="Product images (optional)" hint="One .zip up to 100 MB. Paths must match the image names in your sheet." accept=".zip" icon={FileZipIcon} buttonLabel="Choose ZIP" onFiles={pickZip} filter={false} disabled={busy} />
              </FileSlot>
              {mode === "own" && (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium text-foreground">Product list</p>
                  <p className="text-muted-foreground">{converted ? `${formatNumber(converted.rows)} products from ${converted.sourceName}` : "Match your columns above, then press “Use these products”."}</p>
                </div>
              )}
            </div>
            {fileError && <p className="mt-3 text-sm text-danger" role="alert">{fileError}</p>}
            {error && (
              <Notice tone="danger" className="mt-4" title="The import couldn't start" action={error.jobId ? <Link to={`/seller/listings/import/${error.jobId}`} className="text-sm underline underline-offset-4">Open this import</Link> : undefined}>
                {error.message}
              </Notice>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => void start()} disabled={!excel || busy} loading={busy}>
                <UploadSimpleIcon /> Upload and check
              </Button>
              {busy && <span className="text-sm text-muted-foreground" aria-live="polite">{stageText[stage]}</span>}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="font-heading text-lg font-bold text-foreground">Recent imports</h2>
            {jobs.isLoading ? (
              <Skeleton className="mt-3 h-24 w-full" />
            ) : jobs.error ? (
              <Notice tone="danger" className="mt-3" action={<Button size="sm" variant="secondary" onClick={() => void jobs.refetch()}>Try again</Button>}>
                {importErrorMessage(jobs.error)}
              </Notice>
            ) : !jobs.data?.items.length ? (
              <p className="mt-3 text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border" aria-label="Recent imports">
                {jobs.data.items.map((j) => {
                  const s = statusLabel(j.status);
                  return (
                    <li key={j.jobId}>
                      <Link to={`/seller/listings/import/${j.jobId}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-surface-muted">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">{j.originalFileName ?? "No spreadsheet uploaded"}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDateTime(j.createdAtUtc)} · {formatNumber(j.totalRows)} rows · {formatNumber(j.createdDraftsCount)} drafts created
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
        </>
      )}
    </div>
  );
}

function FileSlot({ file, onClear, disabled, children }: { file: File | null; onClear: () => void; disabled: boolean; children: React.ReactNode }) {
  if (!file) return <>{children}</>;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{file.name}</span>
        <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={disabled} aria-label={`Remove ${file.name}`}>
        <XIcon />
      </Button>
    </div>
  );
}
