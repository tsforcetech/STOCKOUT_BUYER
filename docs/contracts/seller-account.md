# Buyer/seller account context — API contract (user-organization marketplace)

Verified against current `/home/user/stockout/services/user-organization` on 2026-10-17. The latest migration is `028_Stage6F_SearchAdminPermissions.sql`, which only adds permissions; there are no seller changes since `024`. All self-service controllers were re-scanned (`Api/Controllers/Marketplace/*.cs`). **No new seller endpoints exist:** there is no profile update, logo upload/set, member management, unsubmit, or seller deletion. Admin repo `user-organization.md` §6 is still accurate; this file restates it for the buyer site with corrections.
TS types: `src/api/types/seller-account.ts`.

Abbreviations, relative to `services/user-organization/`:
- `C/` = `src/Emcore.UserOrganization.Api/Controllers/`
- `S/` = `src/Emcore.UserOrganization.Application/Marketplace/`
- `K/` = `src/Emcore.UserOrganization.Contracts/Marketplace/`
- `R/` = `src/Emcore.UserOrganization.Infrastructure/Marketplace/`
- `M24` = `Emcore.UserOrganization.Migrator/Migrations/Versioned/024_MarketplaceActorFoundation.sql`

## 0. Conventions

- **Gateway:** `marketplace-route` `/api/v1/marketplace/{**catch-all}` uses `AuthenticatedRoutePolicy`, which needs a valid Bearer JWT **and** an active session (the gateway calls identity `/api/internal/sessions/validate`). It allows 300 requests per minute per user.
  - Sub-paths `/api/v1/marketplace/sellers/{sellerId}/listings[/**]` go to **catalog-listing** instead (Order 10/11). They are not covered here.
  - The gateway injects `X-User-Id` and related headers. The service reads `sub` → `UserId = Guid.Parse(sub)` (`C/BaseApiController.cs:36-43`).
- **No email-verification gate.** PendingVerification users can use every endpoint here.
- **Success envelope:** `{ "success": true, "data": <T> }` (`C/BaseApiController.cs:13-18`).
- **Error shapes:**
  - **E2** ProblemDetails `{type:"https://emcore.platform/errors/{status}", title: "Validation"|"Forbidden"|"NotFound"|"Conflict"|"Failure"|"Error", status, detail, traceId}`. The status mapping is Validation 400, Forbidden 403, NotFound 404, Conflict 409, and anything else 500. **`detail` is empty or null for every marketplace error** because the services set only `Error.Code`, which is not serialized (`C/BaseApiController.cs:20-33`).
  - **E4** `{ "code": "MARKETPLACE_SELLER_ACCESS_DENIED" }` with status 403.
  - **E5** ValidationProblemDetails 400 for a missing or empty required string, malformed JSON, or a non-GUID route id. Route params have no `:guid` constraint, so a bad id fails model binding.
- **DateTimes:** values read from SQL have no `Z`. Parse them as UTC.

## 1. GET /api/v1/marketplace/actors/me

Source: `C/Marketplace/MarketplaceActorsController.cs:24-29` → `S/MarketplaceActorService.cs:34-53`. Any authenticated user.

200 `{ success, data: MarketplaceCurrentActorResponse }` (`K/MarketplaceCurrentActorResponse.cs`):
```
{ userId, buyer: { enabled: true /* hard-coded */ },
  sellerContexts: [{ sellerId, sellerType: "INDIVIDUAL"|"BUSINESS", displayName|null, status: "ACTIVE"|"SUSPENDED",
                     verificationStatus: "UNVERIFIED"|"PENDING"|"VERIFIED"|"REJECTED",
                     onboardingStatus: "DRAFT"|"SUBMITTED"|"UNDER_REVIEW"|"COMPLETED", isOwner }] }
```
- There is one entry per seller where the caller has an `ACTIVE` membership (`M24:211-231`, `PR_SELLER_ACTOR_LIST_BY_USER`). Order is unspecified.
- The file is `#nullable disable`, so `displayName` can be null.
- A brand-new user has `sellerContexts: []`.

## 2. POST /api/v1/marketplace/sellers — create ("become a seller")

Source: `C/Marketplace/MarketplaceSellersController.cs:32-37` → `S/MarketplaceSellerService.cs:59-99`. Any authenticated user.

Body `CreateSellerRequest` (`K/MarketplaceSellerRequests.cs:5-13`):

| Field | Rule |
|---|---|
| `sellerType` | Required (implicit, non-empty). Trimmed and upper-cased; must be `INDIVIDUAL` or `BUSINESS`. |
| `displayName` | Required. Stored as `NVARCHAR(200)`. |
| `legalName` | Required when `BUSINESS`. Stored as `NVARCHAR(200)`. |
| `registrationNo` | Optional. Stored as `NVARCHAR(100)`. |
| `countryCode` | Required. **No format validation.** The procedure parameter is `VARCHAR(3)`. Send ISO-2, for example `AE`. |
| `defaultCurrency` | Required. **No format validation.** The procedure parameter is `VARCHAR(3)`, for example `AED`. |

Response 200, **not 201**: `{ success, data: MarketplaceSellerDto }`.

The new seller is created by `M24:48-125` with:
- `status=ACTIVE`
- `verificationStatus=UNVERIFIED`
- `onboardingStatus=DRAFT`
- the caller as owner (`ORGANIZATION_MEMBER IsOwner=1, MembershipStatus=ACTIVE`).

Idempotency: an **INDIVIDUAL** request by a user who is already a member of any INDIVIDUAL organization returns that **existing** seller unchanged. The request fields are ignored and it still returns 200 (`M24:63-77`). BUSINESS requests always create a new seller.

Errors:
- 400 E5 (missing or empty `sellerType`, `displayName`, `countryCode` or `defaultCurrency`).
- 400 E2 `Validation` (bad `sellerType`, blank-after-trim fields, BUSINESS without `legalName`). The `detail` is empty, so the codes are not visible.
- 500 E2 `Failure` (any DB exception).

`MarketplaceSellerDto` (`K/MarketplaceSellerDto.cs:5-25`, mapped in `S/MarketplaceSellerService.cs:241-264`):
```
{ sellerId, organizationType, email (ALWAYS ""), legalName|null, displayName|null, registrationNo|null, countryCode,
  defaultCurrency, status, verificationStatus, onboardingStatus, profileLogoAssetId|null (never settable),
  submittedAtUtc|null, verifiedAtUtc|null, rejectedAtUtc|null, suspendedAtUtc|null, createdAtUtc, updatedAtUtc,
  rowVersion (base64 of 8-byte SQL rowversion) }
```

## 3. GET /api/v1/marketplace/sellers/{sellerId}

Source: `C/Marketplace/MarketplaceSellersController.cs:39-47`.

Access: any **ACTIVE member** of the seller, checked by `PR_SELLER_ACTOR_GET_CONTEXT`, `M24:188-209`. Otherwise **403 E4**, and that includes an unknown seller id. Platform admins get no bypass.

Responses: 200 `{ success, data: MarketplaceSellerDto }`. 404 E2 `NotFound` can occur only in a race.

## 4. POST /api/v1/marketplace/sellers/{sellerId}/submit

Source: `C/Marketplace/MarketplaceSellersController.cs:49-57` → `S/MarketplaceSellerService.cs:132-145` → `M24:233-281`.

Access: any active member (not only the owner). Otherwise 403 E4.

Body `SubmitRequest` (`C/Marketplace/MarketplaceSellersController.cs:13-16`): `{ "expectedRowVersion": "<rowVersion>" }`. It is required and must be non-empty.

On 200 the response is `{ success, data: MarketplaceSellerDto }` with `onboardingStatus=SUBMITTED`, `verificationStatus=PENDING` and `submittedAtUtc` set. **No documents are required** to submit.

Errors:
- 400 E2 `Validation`: `expectedRowVersion` is not base64 of exactly 8 bytes.
- 404 E2: seller not found.
- **409 E2 `Conflict`**: either the rowVersion is stale or `onboardingStatus ≠ DRAFT`. The two cases cannot be told apart. Re-GET the seller and inspect it.
- 500 E2.

Subsequent lifecycle is admin-only (`C/Marketplace/AdminMarketplaceSellersController.cs`):

| Admin action | New state |
|---|---|
| APPROVE | `VERIFIED` / `COMPLETED` |
| REJECT | `REJECTED` / `DRAFT`. The seller can resubmit with a fresh rowVersion. |
| suspend | `status=SUSPENDED` |

There is no seller-side unsubmit.

A seller's listings appear in public search **only once `verificationStatus=VERIFIED`**: search filters on `seller.isVerified`.

## 5. Seller documents

Source: `C/Marketplace/MarketplaceSellerDocumentsController.cs` (route `api/v1/marketplace/sellers/{sellerId}/documents`).

Access is checked twice:
1. In the controller: active membership, otherwise **403 E4**.
2. In the service: **owner + ACTIVE membership + seller `status=ACTIVE`** (`S/MarketplaceSellerService.cs:101-105`), otherwise **403 E2 `Forbidden`**. This blocks non-owner members and suspended sellers.

| Method & path | Line | Body | Success | Other errors |
|---|---|---|---|---|
| `GET …/documents` | `:27-35` | — | 200 `{success, data: SellerDocumentResponse[]}` (`SELECT *`, no order, `M24:283-290`) | — |
| `POST …/documents` | `:37-45` | `CreateSellerDocumentRequest` | 200 `{success, data: SellerDocumentResponse}` with `verificationStatus:"UNVERIFIED"` and `createdAtUtc` ending in `Z` | 400 E5; 400 E2 `Validation` when `fileAssetId` is not a valid `SELLER_DOCUMENT` file **owned by the caller** (inventory-media internal validate, `S/MarketplaceSellerService.cs:201-202`) |
| `DELETE …/documents/{documentId}` | `:47-55` | — | intended 200 `{success, data:true}` | **always 404 E2 `NotFound`**, even when the row was deleted (defect 1) |

`CreateSellerDocumentRequest` (`K/MarketplaceSellerRequests.cs:15-22`):
- `documentType` (required, free text, `VARCHAR(100)`, no enum)
- `fileAssetId` (GUID)
- `documentNumber` (string or null, `NVARCHAR(100)`)
- `issuedAt` (ISO date or null)
- `expiresAt` (ISO date or null)

`SellerDocumentResponse` (`K/MarketplaceSellerRequests.cs:24-35`): `{ sellerDocumentId, sellerId, documentType, fileAssetId, documentNumber|null, issuedAt|null, expiresAt|null, verificationStatus, createdAtUtc }`.

**File upload for documents** (inventory-media, gateway `/api/v1/files/**` with AuthenticatedRoutePolicy):
1. `POST /api/v1/files/upload-requests` with `{ originalFileName, contentType, sizeBytes, purpose:"SELLER_DOCUMENT" }`. Allowed types are `application/pdf`, `image/jpeg` and `image/png` (`.pdf .jpg .jpeg .png`), up to 20 MB (`services/inventory-media/src/Emcore.InventoryMedia.Application/Services/FileAssetService.cs:33`).
2. PUT the file to the returned presigned URL.
3. `POST /api/v1/files/{id}/complete`.
4. Pass the file id as `fileAssetId`.

Inventory-media responses are `{ data: … }`, with no `success` field (`Contracts/Responses/ApiResponse.cs`). See `src/api/types/files.ts`.

## 6. Known defects

1. **DELETE document returns 404 on success.** `PR_SELLER_DOCUMENT_DELETE` uses `SET NOCOUNT ON`, so Dapper `ExecuteAsync` returns -1 and the `rows > 0` check fails (`R/MarketplaceSellerRepository.cs:175-184`, `M24:328-337`). Treat a 404 on DELETE as "probably deleted" and re-fetch the list.
2. `MarketplaceSellerDto.email` is always `""`, and `profileLogoAssetId` can never be set because no endpoint exists for it.
3. E2 errors carry no machine-readable code and an empty `detail`. Version conflict and invalid transition both arrive as `409 Conflict`.
4. Create returns 200, not 201. A repeated INDIVIDUAL create silently returns the existing seller and ignores the new field values.
5. `countryCode` and `defaultCurrency` have no format validation. The procedure parameters are `VARCHAR(3)`, so SQL Server will silently truncate longer values.
6. Membership checks treat an unknown seller id as 403 E4, not 404.
7. There is no seller profile update, logo, member invite or management, or unsuspend endpoint.
