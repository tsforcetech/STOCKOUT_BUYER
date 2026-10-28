# E2 seller bulk product import (28 Oct 2026)

**Source:** `tsforcetech/STOCKOUT` `main` @ `be93208`. Files:
- `services/catalog-listing/src/Emcore.CatalogListing.Api/Controllers/MarketplaceBulkImportController.cs`
- `Contracts/BulkImport/BulkImportDtos.cs`
- `Application/BulkImport/BulkImportService.cs`, `BulkImportStagingStorage.cs`, `ProductImageZipService.cs`

**Frontend:**
- `src/api/types/bulk-import.ts`
- `src/services/bulk-import.service.ts`
- `src/features/seller/import/*`
- Routes `/seller/listings/import` and `/seller/listings/import/:jobId`.

## Endpoints

Base path: `/api/v1/marketplace/sellers/{sellerId}/listings/bulk-imports`.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/template` | none | `.xlsx` file (`stockout_bulk_product_import_template_v1.xlsx`) |
| GET | `` | `page=1`, `pageSize=20` | `{ items: BulkImportJobResponse[], totalCount, page, pageSize }` |
| POST | `` | `{ templateVersion: "1.0.0" }` | **201** `BulkImportJobResponse` |
| POST | `/{jobId}/upload-excel` | multipart field `file`, `.xlsx` only | `BulkImportJobResponse` |
| POST | `/{jobId}/upload-images-zip` | multipart field `file`, `.zip` only | `BulkImportJobResponse` |
| POST | `/{jobId}/validate` | none | `BulkImportJobResponse` |
| GET | `/{jobId}/preview` | `status`, `page=1`, `pageSize=50` | `BulkImportPreviewResponse` |
| POST | `/{jobId}/confirm` | header **`X-Idempotency-Key` (required)**; body `{ allowPartialSuccess = true, expectedJobStatus = "VALIDATED" }` | `BulkImportConfirmationResponse` |
| GET | `/{jobId}/progress` | none | `{ jobId, status, totalRows, processedRows, createdDraftsCount, percentComplete, isCompleted, completedAtUtc }` |
| GET | `/{jobId}/results` | none | `BulkImportResultResponse` |
| GET | `/{jobId}/errors` | none | `.xlsx` file (`bulk_import_errors_{jobId}.xlsx`) |

**Response format:** responses are plain JSON, not wrapped in `{success, data}`. Errors come back as `{ error, message }` from `MarketplaceExceptionFilter`; an unexpected exception gives `500 { error: "INTERNAL_SERVER_ERROR" }`.

**Access:** every call first runs `ValidateSellerAccessAsync`.
- The caller must be the seller's **OWNER**, and the seller must be able to operate (`CanOperate`). Otherwise the call returns 403 `MARKETPLACE_SELLER_ACCESS_DENIED`.
- If the identity dependency is down, it returns 503 `MARKETPLACE_LISTING_DEPENDENCY_UNAVAILABLE`.
- The UI only shows the import to owners of active sellers (`canManageListings`).

## Job status

The source is followed here, not the handoff's PENDING / PROCESSING wording.

- `CREATED` → `EXCEL_UPLOADED` / `ZIP_UPLOADED` → `VALIDATING` → `VALIDATED` | `VALIDATED_WITH_ERRORS` → `CONFIRMING` → `COMPLETED` | `PARTIALLY_COMPLETED` | `FAILED`.
- `CANCELLED` and `EXPIRED` are terminal.
- Uploads are accepted only in `CREATED`, `EXCEL_UPLOADED`, `ZIP_UPLOADED` and `VALIDATED`. Any other state returns 400 `BULK_IMPORT_INVALID_STATE`. To fix a file after `VALIDATED_WITH_ERRORS`, the seller starts a new job.

**Row statuses**
- After validation: `VALID`, `WARNING` or `INVALID`.
- After confirmation: `CREATED` (with `createdListingId`) or `FAILED`.
- `validRows` counts both VALID and WARNING rows.

**Confirming**
- If any row is INVALID and `allowPartialSuccess` is false, confirm returns 400 `BULK_IMPORT_HAS_INVALID_ROWS`.
- Confirming a job that is already completed returns the stored result instead of creating drafts again.

## Limits and error codes

| Code | When |
|---|---|
| `FILE_EMPTY` | An empty file was uploaded. |
| `INVALID_FILE_FORMAT` | The file is not `.xlsx` (spreadsheet) or not `.zip` (images). |
| `FILE_SIZE_EXCEEDED` | The spreadsheet is over 50 MB, or the ZIP is over 100 MB (`BulkImport:MaxZipSizeBytes`). |
| `INVALID_IMAGE_PATH` | A ZIP entry has an empty or unsafe path. |
| `EXCEL_FILE_MISSING` | Validation was requested before a spreadsheet was uploaded. |
| `INVALID_EXCEL_STRUCTURE` | The workbook has no `Products` sheet. |
| `BULK_IMPORT_JOB_NOT_FOUND` | The job doesn't exist, or belongs to another seller. |
| `IDEMPOTENCY_KEY_REQUIRED` | `/confirm` was called without an `X-Idempotency-Key` header. |

ZIP limits: 500 MB uncompressed in total, 20 MB per entry, 1,000 entries, folders nested at most 3 deep.

## How the UI uses it

- **Template:** the seller downloads the template from the server. The browser never assumes its columns.
- **Upload and check:** one button runs create job → upload the `.xlsx` → upload the `.zip` (if chosen) → validate, then opens the job page.
  - File type and size are checked in the browser first.
  - If the connection drops during validation, the seller is sent to the job page to see the server's status instead of getting an error.
- **Job page:**
  - Shows a summary from `/results`, including ZIP images that no row uses.
  - Lists rows from `/preview` with filters (errors, warnings, ready, created, failed), paged 50 at a time, with each row's server error and warning messages and how many photos matched.
- **Confirm:**
  - If some rows have errors, the seller must tick "Skip the N rows with errors" first.
  - Confirm sends `{ allowPartialSuccess, expectedJobStatus: <current status> }`.
  - The idempotency key is stable per job for the browser session (`sessionStorage`), so a retry is recognised as the same request.
- **Progress:** while the job is `VALIDATING` or `CONFIRMING`, the page polls `/progress` every 3 s. When the server's status changes, the summary and rows reload.
  - A timeout or 502/503/504 shows "we lost the connection" and never shows success.
- **Results:** the error report `.xlsx` is offered when rows failed. Rows that created a draft link to `/seller/listings/{listingId}`.
- **Old uploader:** the client-side CSV uploader (`/seller/listings/bulk`) still works, with a pointer to the new import. The sidebar and the Listings buttons now open the new import.

## Live status (28 Oct 2026, 07:40 UTC)

As the Sharaco owner, `GET /template` and `GET` (list) both return **500 `INTERNAL_SERVER_ERROR`**, every time. A different seller id gives the same 500, so the failure happens before or inside the seller-access check. The control call `GET /marketplace/sellers/{id}/listings` returns 200.

The E2 walkthrough is therefore **blocked by the backend**. See backend issue E2-1.
