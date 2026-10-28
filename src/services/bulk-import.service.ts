import { http } from "@/lib/api/client";
import type {
  BulkImportConfirmationResponse,
  BulkImportJobListResponse,
  BulkImportJobResponse,
  BulkImportPreviewResponse,
  BulkImportProgressResponse,
  BulkImportResultResponse,
  ConfirmBulkImportRequest,
  CreateBulkImportJobRequest,
} from "@/api/types/bulk-import";

/** E2 bulk product import (catalog-listing). Plain (non-enveloped) JSON; files go up as multipart field `file`. */
const seg = encodeURIComponent;
const base = (sellerId: string) => `/api/v1/marketplace/sellers/${seg(sellerId)}/listings/bulk-imports`;
const job = (sellerId: string, jobId: string) => `${base(sellerId)}/${seg(jobId)}`;
/** Uploads, validation and confirmation run inside the request on the server (large sheets / ZIPs take minutes). */
const LONG = { timeoutMs: 10 * 60_000 };
const fileBody = (file: File) => {
  const form = new FormData();
  form.append("file", file, file.name);
  return form;
};

export const bulkImportService = {
  /** The server-generated .xlsx template (stockout_bulk_product_import_template_v1.xlsx). */
  template: (sellerId: string) => http.get<Blob>(`${base(sellerId)}/template`, { responseType: "blob" }),
  list: (sellerId: string, page = 1, pageSize = 20, signal?: AbortSignal) =>
    http.get<BulkImportJobListResponse>(base(sellerId), { query: { page, pageSize }, signal }),
  create: (sellerId: string, body: CreateBulkImportJobRequest = { templateVersion: "1.0.0" }) => http.post<BulkImportJobResponse>(base(sellerId), body),
  /** .xlsx only, ≤ 50 MB. Allowed while the job is CREATED / EXCEL_UPLOADED / ZIP_UPLOADED / VALIDATED. */
  uploadExcel: (sellerId: string, jobId: string, file: File) => http.post<BulkImportJobResponse>(`${job(sellerId, jobId)}/upload-excel`, fileBody(file), LONG),
  /** .zip only, ≤ 100 MB by default. Image paths inside are matched to the sheet's image references. */
  uploadZip: (sellerId: string, jobId: string, file: File) => http.post<BulkImportJobResponse>(`${job(sellerId, jobId)}/upload-images-zip`, fileBody(file), LONG),
  validate: (sellerId: string, jobId: string) => http.post<BulkImportJobResponse>(`${job(sellerId, jobId)}/validate`, undefined, LONG),
  preview: (sellerId: string, jobId: string, q: { status?: string; page?: number; pageSize?: number } = {}, signal?: AbortSignal) =>
    http.get<BulkImportPreviewResponse>(`${job(sellerId, jobId)}/preview`, { query: { status: q.status || undefined, page: q.page ?? 1, pageSize: q.pageSize ?? 50 }, signal }),
  /** X-Idempotency-Key is required; reuse the same key when retrying the same job. */
  confirm: (sellerId: string, jobId: string, body: ConfirmBulkImportRequest, idempotencyKey: string) =>
    http.post<BulkImportConfirmationResponse>(`${job(sellerId, jobId)}/confirm`, body, { ...LONG, idempotencyKey }),
  progress: (sellerId: string, jobId: string, signal?: AbortSignal) => http.get<BulkImportProgressResponse>(`${job(sellerId, jobId)}/progress`, { signal }),
  results: (sellerId: string, jobId: string, signal?: AbortSignal) => http.get<BulkImportResultResponse>(`${job(sellerId, jobId)}/results`, { signal }),
  /** Row errors as .xlsx (bulk_import_errors_{jobId}.xlsx). */
  errors: (sellerId: string, jobId: string) => http.get<Blob>(`${job(sellerId, jobId)}/errors`, { responseType: "blob" }),
};
