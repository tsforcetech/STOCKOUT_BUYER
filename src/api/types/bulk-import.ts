/**
 * E2 seller bulk product import (catalog-listing, `MarketplaceBulkImportController` / `BulkImportDtos.cs`).
 * Base path: /api/v1/marketplace/sellers/{sellerId}/listings/bulk-imports. Responses are NOT enveloped.
 * Errors are `{ error, message }` (MarketplaceExceptionFilter). Only the seller OWNER of an operable seller may call
 * these (403 MARKETPLACE_SELLER_ACCESS_DENIED otherwise).
 */
type Guid = string;
type IsoDateTime = string;

/**
 * Job status as stored by BulkImportService (source wins over the handoff's PENDING/PROCESSING wording):
 * CREATED → EXCEL_UPLOADED / ZIP_UPLOADED → VALIDATING → VALIDATED | VALIDATED_WITH_ERRORS → CONFIRMING →
 * COMPLETED | PARTIALLY_COMPLETED | FAILED. CANCELLED and EXPIRED are terminal.
 */
export type BulkImportJobStatus =
  | "CREATED"
  | "EXCEL_UPLOADED"
  | "ZIP_UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "VALIDATED_WITH_ERRORS"
  | "CONFIRMING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

/** Row status after validation. CREATED / FAILED after confirmation. */
export type BulkImportRowStatus = "VALID" | "WARNING" | "INVALID" | "CREATED" | "FAILED";

/** Statuses that accept a new Excel or ZIP upload (BulkImportService.UploadExcelAsync / UploadZipAsync). */
export const BULK_UPLOADABLE_STATUSES: readonly string[] = ["CREATED", "EXCEL_UPLOADED", "ZIP_UPLOADED", "VALIDATED"];
/** Statuses the server is still working on; poll /progress while in these. */
export const BULK_WORKING_STATUSES: readonly string[] = ["VALIDATING", "CONFIRMING"];
/** Terminal per GetProgressAsync (`isCompleted`). */
export const BULK_DONE_STATUSES: readonly string[] = ["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"];

/** Server limits (BulkImportStagingStorage / ProductImageZipService defaults; ZIP size is configurable server-side). */
export const BULK_MAX_EXCEL_BYTES = 50 * 1024 * 1024;
export const BULK_MAX_ZIP_BYTES = 100 * 1024 * 1024;

export interface CreateBulkImportJobRequest {
  templateVersion: string;
}

export interface BulkImportJobResponse {
  jobId: Guid;
  sellerId: Guid;
  createdByUserId: Guid;
  templateVersion: string;
  status: BulkImportJobStatus | string;
  originalFileName: string | null;
  excelFileAssetId: Guid | null;
  zipOriginalFileName: string | null;
  zipFileAssetId: Guid | null;
  totalRows: number;
  validRows: number;
  failedRows: number;
  warningRows: number;
  processedRows: number;
  createdDraftsCount: number;
  errorSummary: string | null;
  createdAtUtc: IsoDateTime;
  validatedAtUtc: IsoDateTime | null;
  confirmedAtUtc: IsoDateTime | null;
  completedAtUtc: IsoDateTime | null;
  rowVersion: string;
}

export interface BulkImportErrorDto {
  code: string;
  field: string;
  message: string;
}

export interface BulkImportLocationDto {
  countryCode: string;
  stateOrEmirate: string;
  city: string;
}

export interface BulkImportRowPreviewDto {
  rowId: Guid;
  rowNumber: number;
  sellerSku: string;
  status: BulkImportRowStatus | string;
  title: string | null;
  categoryId: Guid | null;
  categoryCode: string | null;
  brandNameOrId: string | null;
  conditionNameOrId: string | null;
  gradeNameOrId: string | null;
  quantity: number | null;
  unitNameOrId: string | null;
  price: number | null;
  currency: string | null;
  pricingMode: string | null;
  description: string | null;
  location: BulkImportLocationDto | null;
  matchedImageCount: number;
  coverImageRef: string | null;
  imageReferences: string[];
  attributes: Record<string, string>;
  errors: BulkImportErrorDto[];
  warnings: BulkImportErrorDto[];
  createdListingId: Guid | null;
  createdListingVersionId: Guid | null;
}

/** GET …/{jobId}/preview?status=&page=&pageSize= (pageSize default 50). */
export interface BulkImportPreviewResponse {
  jobId: Guid;
  sellerId: Guid;
  status: BulkImportJobStatus | string;
  totalRows: number;
  validRows: number;
  failedRows: number;
  warningRows: number;
  unmatchedZipFiles: string[];
  missingImagesCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
  rows: BulkImportRowPreviewDto[];
}

/** POST …/{jobId}/confirm — requires X-Idempotency-Key. Invalid rows block the import unless allowPartialSuccess. */
export interface ConfirmBulkImportRequest {
  allowPartialSuccess: boolean;
  expectedJobStatus?: string | null;
}

export interface BulkImportConfirmationResponse {
  jobId: Guid;
  status: BulkImportJobStatus | string;
  totalRows: number;
  createdDraftsCount: number;
  failedRowsCount: number;
  createdListingIds: Guid[];
  errorSummary: string | null;
  completedAtUtc: IsoDateTime | null;
}

export interface BulkImportProgressResponse {
  jobId: Guid;
  status: BulkImportJobStatus | string;
  totalRows: number;
  processedRows: number;
  createdDraftsCount: number;
  percentComplete: number;
  isCompleted: boolean;
  completedAtUtc: IsoDateTime | null;
}

export interface BulkImportResultResponse {
  jobId: Guid;
  sellerId: Guid;
  status: BulkImportJobStatus | string;
  totalRows: number;
  validRows: number;
  failedRows: number;
  warningRows: number;
  createdDraftsCount: number;
  errorSummary: string | null;
  unmatchedZipImages: string[];
  createdAtUtc: IsoDateTime;
  validatedAtUtc: IsoDateTime | null;
  confirmedAtUtc: IsoDateTime | null;
  completedAtUtc: IsoDateTime | null;
}

export interface BulkImportJobListResponse {
  items: BulkImportJobResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}
