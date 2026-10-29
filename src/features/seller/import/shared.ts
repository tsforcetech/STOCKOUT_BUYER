import type { BadgeTone } from "@/components/ui/misc";
import { isApiError } from "@/lib/api/errors";
import { errorCode, sellerErrorMessage } from "../lib/errors";

export const importKeys = {
  all: (sellerId: string) => ["seller", sellerId, "bulk-imports"] as const,
  list: (sellerId: string, page: number) => ["seller", sellerId, "bulk-imports", "list", page] as const,
  results: (sellerId: string, jobId: string) => ["seller", sellerId, "bulk-imports", jobId, "results"] as const,
  progress: (sellerId: string, jobId: string) => ["seller", sellerId, "bulk-imports", jobId, "progress"] as const,
  preview: (sellerId: string, jobId: string, status: string, page: number) => ["seller", sellerId, "bulk-imports", jobId, "preview", status, page] as const,
};

/** The import wizard: the first three steps are on the import page, the last on the job page. */
export const IMPORT_STEPS = ["Upload your list", "Match columns", "Photos", "Review & import"] as const;

/** How often to ask /progress while the server is validating or creating drafts. */
export const POLL_MS = 3000;

export const STATUS_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  CREATED: { label: "Waiting for file", tone: "neutral" },
  EXCEL_UPLOADED: { label: "File uploaded", tone: "neutral" },
  ZIP_UPLOADED: { label: "Images uploaded", tone: "neutral" },
  VALIDATING: { label: "Checking", tone: "warning" },
  VALIDATED: { label: "Ready to import", tone: "info" },
  VALIDATED_WITH_ERRORS: { label: "Has errors", tone: "warning" },
  CONFIRMING: { label: "Creating drafts", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  PARTIALLY_COMPLETED: { label: "Partly completed", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};
export const statusLabel = (s: string) => STATUS_LABELS[s] ?? { label: s, tone: "neutral" as BadgeTone };

export const ROW_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  VALID: { label: "Ready", tone: "success" },
  WARNING: { label: "Warning", tone: "warning" },
  INVALID: { label: "Error", tone: "danger" },
  CREATED: { label: "Draft created", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};
export const rowLabel = (s: string) => ROW_LABELS[s] ?? { label: s, tone: "neutral" as BadgeTone };

const MESSAGES: Record<string, string> = {
  MARKETPLACE_SELLER_ACCESS_DENIED: "Only the owner of an active seller account can import listings.",
  MARKETPLACE_LISTING_DEPENDENCY_UNAVAILABLE: "The seller service is temporarily unavailable. Please try again shortly.",
  BULK_IMPORT_JOB_NOT_FOUND: "This import doesn't exist for your seller account.",
  BULK_IMPORT_INVALID_STATE: "This import can't take a new file at its current stage. Start a new import instead.",
  INVALID_FILE_FORMAT: "That file type isn't supported. Use the .xlsx template, and a .zip for images.",
  FILE_EMPTY: "The selected file is empty.",
  FILE_SIZE_EXCEEDED: "The file is too large. Spreadsheets can be up to 50 MB and image ZIPs up to 100 MB.",
  EXCEL_FILE_MISSING: "Upload the spreadsheet before checking it.",
  INVALID_EXCEL_STRUCTURE: "The workbook has no 'Products' sheet. Download the template and fill in its Products sheet.",
  INVALID_IMAGE_PATH: "The ZIP contains an unsafe or empty file path. Re-create the ZIP with plain folder and file names.",
  IDEMPOTENCY_KEY_REQUIRED: "The import couldn't be confirmed safely. Reload the page and try again.",
  DURABLE_STORAGE_UNAVAILABLE: "File storage for imports is temporarily unavailable, so your file wasn't uploaded. Nothing was imported; please try again later.",
  INVALID_ZIP_ARCHIVE: "That ZIP file can't be opened — it may be damaged or not a real .zip. Re-create it (select the photo folders → Compress) and upload it again.",
  ZIP_EMPTY: "That ZIP file is empty. Put the photo folders in it and upload it again.",
  ZIP_VALIDATION_FAILED: "There's a problem with the photos ZIP, so no rows were checked. See the details on the import, fix the ZIP and check again.",
  INVALID_EXCEL_FILE: "The spreadsheet is damaged or isn't a real .xlsx file. Save it again from Excel as .xlsx and upload it.",
  BULK_IMPORT_NO_VALID_ROWS: "No row is ready to import. Fix the rows with errors and check the file again.",
  BULK_IMPORT_JOB_NOT_VALIDATED: "This import hasn't been checked yet, so it can't be imported. Check the rows first.",
  BULK_IMPORT_JOB_STATUS_CONFLICT: "This import is already being imported or has finished, so it can't be checked again.",
  BULK_IMPORT_CONFIRMATION_IN_PROGRESS: "This import is already being created. Wait for it to finish — refresh in a moment.",
  BULK_IMPORT_VALIDATION_FAILED: "Checking stopped because of a problem on our side. The import was marked failed; try checking it again.",
  BULK_IMPORT_HAS_INVALID_ROWS: "Some rows have errors. Tick “Skip rows with errors” to import only the ready rows, or fix the file and start a new import.",
};

export function importErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (isApiError(error) && error.status === 500) return "The import service hit an unexpected error. Nothing was imported; please try again later.";
  return sellerErrorMessage(error);
}

/** Lost connection / timeout: the request may still have reached the server, so never present it as success or failure. */
export function isUncertain(error: unknown): boolean {
  if (isApiError(error)) return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
  return true;
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One idempotency key per job, kept for the browser session so a retried confirm is recognised as the same request. */
export function confirmKey(jobId: string): string {
  const k = `stockout.bulk-import.confirm.${jobId}`;
  try {
    const existing = sessionStorage.getItem(k);
    if (existing) return existing;
    const fresh = `bulk-${jobId}-${crypto.randomUUID()}`.slice(0, 100);
    sessionStorage.setItem(k, fresh);
    return fresh;
  } catch {
    return `bulk-${jobId}`;
  }
}
