import * as React from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowClockwiseIcon, CheckCircleIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Checkbox, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import { bulkImportService } from "@/services/bulk-import.service";
import { BULK_UPLOADABLE_STATUSES, BULK_WORKING_STATUSES, type BulkImportResultResponse, type BulkImportRowPreviewDto } from "@/api/types/bulk-import";
import { ListingAccessNotice, canManageListings } from "../components/listing-access-notice";
import { Notice } from "../components/notice";
import { BackLink } from "../components/back-link";
import { Stepper } from "../components/stepper";
import { sellerKeys, useActiveSeller, useListingRequirements } from "../lib/queries";
import { IMPORT_STEPS, confirmKey, importErrorMessage, importKeys, isUncertain, POLL_MS, rowLabel, saveBlob, statusLabel } from "./shared";

const FILTERS = [
  { key: "", label: "All rows" },
  { key: "INVALID", label: "Errors" },
  { key: "WARNING", label: "Warnings" },
  { key: "VALID", label: "Ready" },
  { key: "CREATED", label: "Drafts created" },
  { key: "FAILED", label: "Failed" },
] as const;
const PAGE_SIZE = 50;
/** A check still running after this long has most likely stopped on the server. */
const STUCK_MS = 15 * 60_000;

/**
 * E2 import job: shows the server's check results row by row, lets the owner confirm, then follows the job until
 * the server reports it finished. Status always comes from the API; a lost connection is never shown as success.
 */
export default function SellerImportJobPage() {
  const seller = useActiveSeller();
  const { jobId = "" } = useParams();
  return (
    <div className="space-y-4">
      <BackLink to="/seller/listings/import">Bulk import</BackLink>
      {canManageListings(seller) ? <JobView sellerId={seller.sellerId} jobId={jobId} /> : <ListingAccessNotice seller={seller} />}
    </div>
  );
}

function JobView({ sellerId, jobId }: { sellerId: string; jobId: string }) {
  const qc = useQueryClient();
  const results = useQuery({ queryKey: importKeys.results(sellerId, jobId), queryFn: ({ signal }) => bulkImportService.results(sellerId, jobId, signal) });
  const status = results.data?.status ?? "";
  const working = BULK_WORKING_STATUSES.includes(status);
  const progress = useQuery({
    queryKey: importKeys.progress(sellerId, jobId),
    queryFn: ({ signal }) => bulkImportService.progress(sellerId, jobId, signal),
    enabled: working,
    refetchInterval: (q) => (q.state.data && (q.state.data.isCompleted || !BULK_WORKING_STATUSES.includes(q.state.data.status)) ? false : POLL_MS),
  });
  const refreshAll = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: importKeys.all(sellerId) });
  }, [qc, sellerId]);

  // When the server moves on (validated, finished or failed), reload the summary and rows.
  const progressStatus = progress.data?.status;
  React.useEffect(() => {
    if (progressStatus && results.data && progressStatus !== results.data.status) {
      refreshAll();
      void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId) });
    }
  }, [progressStatus, results.data, refreshAll, qc, sellerId]);

  if (results.isLoading) return <Skeleton className="h-64 w-full" />;
  if (results.error || !results.data) {
    return (
      <Notice tone="danger" title="This import couldn't be loaded" action={<Button size="sm" variant="secondary" onClick={() => void results.refetch()}>Try again</Button>}>
        {importErrorMessage(results.error)}
      </Notice>
    );
  }
  const r = results.data;
  const s = statusLabel(r.status);

  return (
    <>
      <PageHeader
        title="Bulk import"
        description={`Started ${formatDateTime(r.createdAtUtc)}${r.completedAtUtc ? ` · Finished ${formatDateTime(r.completedAtUtc)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.tone}>{s.label}</Badge>
            <Button variant="secondary" size="sm" onClick={refreshAll} aria-label="Refresh import">
              <ArrowClockwiseIcon />
            </Button>
          </div>
        }
      />
      {/* Finished imports show every step done. */}
      <Stepper steps={IMPORT_STEPS} current={["COMPLETED", "PARTIALLY_COMPLETED"].includes(r.status) ? IMPORT_STEPS.length + 1 : IMPORT_STEPS.length} />
      <Summary r={r} />
      {working && (
        <SectionCard>
          <p className="text-sm font-medium text-foreground" aria-live="polite">
            {r.status === "VALIDATING" ? "Checking your rows…" : "Creating listing drafts…"} {progress.data ? `${formatNumber(progress.data.processedRows)} of ${formatNumber(progress.data.totalRows)}` : ""}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.data?.percentComplete ?? 0}>
            <div className="h-full bg-action transition-all" style={{ width: `${Math.min(100, Math.max(0, progress.data?.percentComplete ?? 0))}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">You can leave this page; the import continues on the server. Come back to Bulk import to see the result.</p>
          {r.status === "VALIDATING" && Date.now() - Date.parse(r.createdAtUtc.endsWith("Z") ? r.createdAtUtc : `${r.createdAtUtc}Z`) > STUCK_MS && (
            <Notice
              tone="warning"
              className="mt-3"
              title="This is taking much longer than usual"
              action={<RecheckButton sellerId={sellerId} jobId={r.jobId} onChanged={refreshAll} />}
            >
              Checking normally takes a minute or two. Check again to restart it — rows are re-checked from your uploaded files and nothing is imported until you confirm.
            </Notice>
          )}
          {progress.error && <p className="mt-2 text-sm text-danger">{importErrorMessage(progress.error)} We&apos;ll keep trying.</p>}
        </SectionCard>
      )}
      <Actions sellerId={sellerId} r={r} onChanged={refreshAll} />
      <Rows sellerId={sellerId} jobId={jobId} status={r.status} />
    </>
  );
}

function Summary({ r }: { r: BulkImportResultResponse }) {
  const items = [
    { label: "Rows", value: r.totalRows },
    { label: "Ready", value: r.validRows },
    { label: "With warnings", value: r.warningRows },
    { label: "With errors", value: r.failedRows, danger: r.failedRows > 0 },
    { label: "Drafts created", value: r.createdDraftsCount },
  ];
  return (
    <SectionCard>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-surface-muted px-3 py-3">
            <dt className="text-xs text-muted-foreground">{i.label}</dt>
            <dd className={cn("font-heading text-2xl font-bold tabular-nums", i.danger ? "text-danger" : "text-foreground")}>{formatNumber(i.value)}</dd>
          </div>
        ))}
      </dl>
      {r.errorSummary && <Notice tone={r.status === "FAILED" ? "danger" : "warning"} className="mt-4">{r.errorSummary}</Notice>}
      {r.unmatchedZipImages.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-foreground">{formatNumber(r.unmatchedZipImages.length)} images in the ZIP aren&apos;t used by any row</summary>
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
            {r.unmatchedZipImages.map((f) => (
              <li key={f} className="break-all">{f}</li>
            ))}
          </ul>
        </details>
      )}
    </SectionCard>
  );
}

function Actions({ sellerId, r, onChanged }: { sellerId: string; r: BulkImportResultResponse; onChanged: () => void }) {
  const qc = useQueryClient();
  const [skipErrors, setSkipErrors] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "confirm" | "validate" | "errors">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uncertain, setUncertain] = React.useState(false);
  const importable = r.validRows; // VALID + WARNING rows (BulkImportService counts warnings as valid)
  const canConfirm = (r.status === "VALIDATED" || r.status === "VALIDATED_WITH_ERRORS") && importable > 0;
  const needsSkip = r.status === "VALIDATED_WITH_ERRORS" && r.failedRows > 0;
  const done = r.status === "COMPLETED" || r.status === "PARTIALLY_COMPLETED";

  const confirm = async () => {
    setBusy("confirm");
    setError(null);
    setUncertain(false);
    try {
      const res = await bulkImportService.confirm(sellerId, r.jobId, { allowPartialSuccess: needsSkip ? skipErrors : true, expectedJobStatus: r.status }, confirmKey(r.jobId));
      setConfirming(false);
      if (res.status === "COMPLETED" || res.status === "PARTIALLY_COMPLETED") toast.success(`${formatNumber(res.createdDraftsCount)} listing drafts created.`);
      void qc.invalidateQueries({ queryKey: ["seller", sellerId, "listings"] });
    } catch (e) {
      setConfirming(false);
      if (isUncertain(e)) setUncertain(true);
      else setError(importErrorMessage(e));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const validate = async () => {
    setBusy("validate");
    setError(null);
    try {
      await bulkImportService.validate(sellerId, r.jobId);
    } catch (e) {
      if (isUncertain(e)) setUncertain(true);
      else setError(importErrorMessage(e));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const downloadErrors = async () => {
    setBusy("errors");
    setError(null);
    try {
      saveBlob(await bulkImportService.errors(sellerId, r.jobId), `bulk_import_errors_${r.jobId}.xlsx`);
    } catch (e) {
      setError(importErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const showErrorsReport = r.failedRows > 0 && (r.status === "VALIDATED_WITH_ERRORS" || r.status === "PARTIALLY_COMPLETED" || r.status === "COMPLETED");
  const needsCheck = BULK_UPLOADABLE_STATUSES.includes(r.status) && r.status !== "VALIDATED";

  if (!canConfirm && !showErrorsReport && !needsCheck && !done && !["FAILED", "CANCELLED", "EXPIRED"].includes(r.status) && !error && !uncertain) return null;

  return (
    <SectionCard className="space-y-4">
      {uncertain && (
        <Notice tone="warning" title="We lost the connection before the server answered">
          The request may still be running. This page shows the status the server reports. Check again in a moment before trying anything else.
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}

      {needsCheck && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">The files are uploaded but haven&apos;t been checked yet.</p>
          <Button onClick={() => void validate()} loading={busy === "validate"}>
            Check rows
          </Button>
        </div>
      )}

      {canConfirm && (
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-foreground">Create the drafts</h2>
          <p className="text-sm text-muted-foreground">
            {formatNumber(importable)} {importable === 1 ? "row is" : "rows are"} ready. Each becomes a listing draft you can review, edit and submit from Listings.
          </p>
          {needsSkip && (
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox checked={skipErrors} onCheckedChange={(v) => setSkipErrors(v === true)} aria-label={`Skip the ${r.failedRows} rows with errors`} className="mt-0.5" />
              <span>
                Skip the {formatNumber(r.failedRows)} {r.failedRows === 1 ? "row" : "rows"} with errors and import only the ready rows. To include them, fix the file and start a new import.
              </span>
            </label>
          )}
          <Button onClick={() => setConfirming(true)} disabled={(needsSkip && !skipErrors) || busy !== null}>
            <CheckCircleIcon /> Import {formatNumber(importable)} {importable === 1 ? "row" : "rows"}
          </Button>
        </div>
      )}
      {r.status === "VALIDATED_WITH_ERRORS" && importable === 0 && <Notice tone="warning">No row is ready to import. Download the error report, fix the file and start a new import.</Notice>}

      {done && (
        <Notice tone={r.status === "COMPLETED" ? "info" : "warning"} title={r.status === "COMPLETED" ? "Import finished" : "Import finished with some failed rows"}>
          {formatNumber(r.createdDraftsCount)} listing drafts were created.{" "}
          <Link to="/seller/listings" className="underline underline-offset-4">
            Open Listings
          </Link>{" "}
          to review and submit them. Rows that created a draft link to it below.
        </Notice>
      )}
      {["FAILED", "CANCELLED", "EXPIRED"].includes(r.status) && (
        <Notice tone="danger" title={`This import ${r.status === "FAILED" ? "failed" : r.status === "EXPIRED" ? "expired" : "was cancelled"}`}>
          No further action is possible on it.{" "}
          <Link to="/seller/listings/import" className="underline underline-offset-4">
            Start a new import
          </Link>
          .
        </Notice>
      )}

      {showErrorsReport && (
        <Button variant="secondary" onClick={() => void downloadErrors()} loading={busy === "errors"}>
          <DownloadSimpleIcon /> Download error report (.xlsx)
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="primary"
        title={`Create ${formatNumber(importable)} listing drafts?`}
        description="Drafts are private until you submit them for review. Re-confirming this import later won't create duplicates."
        confirmLabel="Create drafts"
        loading={busy === "confirm"}
        onConfirm={() => void confirm()}
      />
    </SectionCard>
  );
}

function Rows({ sellerId, jobId, status }: { sellerId: string; jobId: string; status: string }) {
  const [filter, setFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const preview = useQuery({
    queryKey: importKeys.preview(sellerId, jobId, filter, page),
    queryFn: ({ signal }) => bulkImportService.preview(sellerId, jobId, { status: filter, page, pageSize: PAGE_SIZE }, signal),
    enabled: !["CREATED", "EXCEL_UPLOADED", "ZIP_UPLOADED", "VALIDATING"].includes(status),
  });
  if (["CREATED", "EXCEL_UPLOADED", "ZIP_UPLOADED", "VALIDATING"].includes(status)) return null;
  const data = preview.data;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / (data.pageSize || PAGE_SIZE))) : 1;

  return (
    <SectionCard>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter rows">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "action" : "secondary"}
            aria-pressed={filter === f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {data && data.missingImagesCount > 0 && (
        <Notice tone="warning" className="mb-3">
          {formatNumber(data.missingImagesCount)} image {data.missingImagesCount === 1 ? "reference wasn't" : "references weren't"} found in the ZIP. Those rows import without that photo.
        </Notice>
      )}
      {preview.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : preview.error ? (
        <Notice tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void preview.refetch()}>Try again</Button>}>
          {importErrorMessage(preview.error)}
        </Notice>
      ) : !data?.rows.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No rows here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Imported rows</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Row</th>
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Quantity</th>
                <th className="py-2 pr-3 font-medium">Price</th>
                <th className="py-2 pr-3 font-medium">Photos</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((row) => (
                <RowLine key={row.rowId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function RowLine({ row }: { row: BulkImportRowPreviewDto }) {
  const s = rowLabel(row.status);
  const messages = [...row.errors.map((m) => ({ ...m, kind: "error" as const })), ...row.warnings.map((m) => ({ ...m, kind: "warning" as const }))];
  return (
    <tr className="align-top">
      <td className="py-2 pr-3 tabular-nums text-muted-foreground">{row.rowNumber}</td>
      <td className="py-2 pr-3">
        <p className="font-medium text-foreground">
          {row.createdListingId ? (
            <Link to={`/seller/listings/${row.createdListingId}`} className="underline underline-offset-4">
              {row.title || "Untitled"}
            </Link>
          ) : (
            row.title || <span className="text-muted-foreground">No title</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          SKU {row.sellerSku || "—"}
          {row.categoryCode ? ` · ${row.categoryCode}` : ""}
        </p>
        {messages.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs">
            {messages.map((m, i) => (
              <li key={`${m.code}-${i}`} className={m.kind === "error" ? "text-danger" : "text-warning-soft-foreground"}>
                {m.field ? <span className="font-medium">{m.field}: </span> : null}
                {m.message || m.code}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-2 pr-3 tabular-nums">
        {row.quantity != null ? (
          <>
            {formatNumber(row.quantity)} <UnitText value={row.unitNameOrId} categoryId={row.categoryId} />
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="py-2 pr-3 tabular-nums">{row.price != null ? `${row.currency ?? ""} ${formatNumber(row.price)}` : "—"}</td>
      <td className="py-2 pr-3 tabular-nums">
        {/* The server also matches photos by the SKU's ZIP folder, so the count can exceed the references in the file. */}
        <span title={`${row.matchedImageCount} photo(s) matched; ${row.imageReferences.length} referenced in the file`}>{formatNumber(row.matchedImageCount)}</span>
      </td>
      <td className="py-2 pr-3">
        <Badge tone={s.tone}>{s.label}</Badge>
      </td>
    </tr>
  );
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The server returns the unit resolved to its id once a row is checked; show the unit's symbol instead. */
function UnitText({ value, categoryId }: { value: string | null; categoryId: string | null }) {
  const isId = !!value && GUID.test(value);
  const req = useListingRequirements(isId ? categoryId : null);
  if (!value) return null;
  if (!isId) return <>{value}</>;
  const unit = req.data?.unitRules.units.find((u) => u.unitId.toLowerCase() === value.toLowerCase());
  return <>{unit ? unit.symbol || unit.code : ""}</>;
}

/** Restarts a check that stopped on the server (the backend takes over a VALIDATING job whose lease has expired). */
function RecheckButton({ sellerId, jobId, onChanged }: { sellerId: string; jobId: string; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await bulkImportService.validate(sellerId, jobId);
      toast.success("Checking restarted.");
    } catch (e) {
      toast.error(importErrorMessage(e));
    } finally {
      setBusy(false);
      onChanged();
    }
  };
  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={() => void run()}>
      <ArrowClockwiseIcon /> Check again
    </Button>
  );
}
