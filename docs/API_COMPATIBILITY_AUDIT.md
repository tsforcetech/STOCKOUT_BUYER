# API compatibility audit — stockout_buyer vs. stockout backend

Date: 2026-10-18. Backend: `/home/user/stockout` (read-only, latest commit). Frontend: this repo.

Method: every `http.*` call in `src/services/*.ts` (no direct `http.` usage exists outside services and the client's own tests) was
traced to its call sites in `src/features/**` / `src/lib/**`, then checked against the gateway route
(`gateways/Emcore.ApiGateway/appsettings.json`), the C# controller, request/response DTOs, service validation and, where values
come from SQL, the stored procedure. DTO field names/nullability were additionally diffed mechanically (C# property → camelCase vs
the TS interfaces in `src/api/types/*`): **no field-name mismatches** were found in any service.

Abbreviations (backend paths): `IA` = `services/identity-access/src`, `UO` = `services/user-organization/src`,
`CL` = `services/catalog-listing/src`, `IM` = `services/inventory-media/src`, `SD` = `services/search-discovery/src`,
`GW` = `gateways/Emcore.ApiGateway/appsettings.json`. Controllers live under `*/…Api/Controllers/`.

Envelopes: IA, SD and CL seller endpoints return bare DTOs; UO returns `{ success, data }` (`UO/…/BaseApiController.cs:13-17`);
CL public taxonomy returns `{ success, data }` (`CL/…Contracts/Responses/ApiResponse.cs`); IM returns `{ data }`
(`IM/…Contracts/Responses/ApiResponse.cs`). `unwrapData` accepts both wrapped shapes; bare services never call it.

Gateway: `/api/v1/auth/*` Public (LoginOtp 10/min per IP+path, GW:48), `/identity/*` Authenticated (GW:56), `/users/*`
Authenticated (GW:64), `/files/*` Authenticated (GW:38), `/catalog/*` Public (GW:120), `/search/*` Public (GW:144),
`/marketplace/*` Authenticated → user-organization (GW:425, Order 100), `/marketplace/sellers/{sellerId}/listings[/**]`
Authenticated → catalog-listing (GW:443/452, Order 10/11). Paths are forwarded unchanged. Every UI path matches one of these.

## Endpoint table

| # | Method | Path | Screen(s) | Request | Response | Notes (evidence) |
|---|---|---|---|---|---|---|
| 1 | POST | /api/v1/auth/login | Login, header login popover | ✓ | ✓ | `IA/AuthController.cs:42` AllowAnonymous; `LoginRequest(EmailOrMobile, Password)` DTOs.cs:24; MFA branch returns `mfaRequired`, `mfaChallengeToken`=challenge.Id, `userId` (Handlers.cs:595-618). 401/403 titles "Account Locked"/"Account Disabled" (Handlers.cs:563-572) match login-page.tsx. auth:false ✓ |
| 2 | POST | /api/v1/auth/mfa/verify | Login (MFA step) | ✓ | ✓ | `MfaController.cs:27`; `MfaLoginVerifyRequest(UserId, ChallengeToken, Code, RecoveryCode)` DTOs.cs:76; wrong code → 401 (Handlers.cs:921-925) as UI expects |
| 3 | POST | /api/v1/auth/mfa/resend | Login (MFA step) | ✓ | ✓ | `MfaController.cs:66` anonymous; `ResendMfaRequest(UserId, ChallengeId)`; new `challengeId` replaces the old one (Handlers.cs:978-1004) — UI swaps it in |
| 4 | POST | /api/v1/auth/token/refresh | Session restore / 401 retry | ✓ | ✓ | `AuthController.cs:57`; `RefreshResponse` DTOs.cs:28; 400 blank / 401 invalid (Handlers.cs:660-678) — UI clears tokens on both |
| 5 | DELETE | /api/v1/auth/sessions/{sessionId} | Sign-out, Security → sessions | ✓ | ✓ | `AuthController.cs:103`; JWT carries `sid` (IA/Infrastructure/Security/SecurityServices.cs:145). Used for sign-out because `/logout` only revokes when a refresh token is sent |
| 6 | POST | /api/v1/auth/logout-all | Security → sessions | ✓ | ✓ | `AuthController.cs:81`, no body |
| 7 | GET | /api/v1/auth/sessions | Security → sessions | ✓ | ✓ | `AuthController.cs:92`; `SessionDto` DTOs.cs:43 (bare array) |
| 8 | POST | /api/v1/auth/password/forgot | Forgot password | ✓ | ✓ | `PasswordController.cs:27`; returns `ForgotPasswordResponse{message}` (always 200) |
| 9 | POST | /api/v1/auth/password/reset | Reset password | ✓ | ✓ | `PasswordController.cs:40`; `ResetPasswordRequest(Token, NewPassword, EmailOrMobile?, StepUpToken?)` DTOs.cs:36; 400 for bad token/short password (Handlers.cs:757-799) |
| 10 | POST | /api/v1/auth/password/change | Security → password | ✓ | ✓ | `PasswordController.cs:53`; 400 "Current password provided is incorrect." / "at least N" (Handlers.cs:809-825) match the UI regexes |
| 11 | GET | /api/v1/identity/me | Auth bootstrap, header, profile | ✓ | ✓ | `AccountController.cs:39`; `CurrentIdentityResponse` DTOs.cs:56 |
| 12 | GET | /api/v1/auth/account/status | (service only, unused) | ✓ | ✓ | `AccountController.cs:28`; `AccountStatusResponse` DTOs.cs:45 |
| 13 | GET | /api/v1/auth/account/activity | Security → activity | ✓ | ✓ | `AccountController.cs:50` query `page,pageSize,eventType,fromUtc,toUtc` (DateTime? — UI sends `yyyy-MM-ddT00:00:00Z`); event codes = `IA/Domain/Enums/Enums.cs:15-34` + `USER_STATUS_CHANGE` |
| 14 | GET | /api/v1/auth/mfa/status | Security → MFA | ✓ | ✓ | `MfaController.cs:104`; `MfaStatusResponse(Enabled, Type)` AccountActivityDTOs.cs:6 |
| 15 | POST | /api/v1/auth/mfa/register | Security → MFA | ✓ | ✓ | `MfaController.cs:41`; body `{type:"EMAIL_OTP"}`; `challengeId` returned (Handlers.cs:1057) |
| 16 | POST | /api/v1/auth/mfa/confirm | Security → MFA | ✓ | ✓ | `MfaController.cs:53`; 6-digit code + challengeId required (Handlers.cs:1063-1081) |
| 17 | POST | /api/v1/auth/register | Register | **fixed** | ✓ | `AuthController.cs:28`; all six fields required non-empty; each name ≤100 (Handlers.cs:89-101). UI built `displayName` = first+" "+last, which can exceed 100 → now clipped. 409 detail "Email/Mobile already registered." (IA/Infrastructure/Persistence/IdentityRepository.cs:121-125) |
| 18 | POST | /api/v1/auth/verification/registration/confirm | Register (verify step) | ✓ | ✓ | `VerificationController.cs:77`; `{userId, channel:"Email", token}`; 6-digit OTP (SecurityServices.cs:175-179); bad code → 400 (Handlers.cs:496-500) |
| 19 | POST | /api/v1/auth/verification/email/send | Register (resend) | ✓ | ✓ | `VerificationController.cs:27`; always 200 `{message}` (Handlers.cs:340-382) |
| 20 | GET | /api/v1/catalog/categories | Header menu, home, categories, seller category picker | ✓ | ✓ | `CL/PublicCategoriesController.cs:12,22` anonymous; `{success,data:PublicCategoryTreeResponse[]}` (CategoryResponses.cs:22-29) |
| 21 | GET | /api/v1/catalog/brands | (service only, unused) | ✓ | ✓ | `CL/PublicBrandsController.cs:12,22` |
| 22 | GET | /api/v1/catalog/categories/{id}/listing-requirements | Listing new/edit (details, attributes, inventory tabs) | ✓ | ✓ | `CL/PublicListingRequirementsController.cs:13` (`:guid`); 404/409 codes CATEGORY_NOT_FOUND/INACTIVE; `ListingRequirementsResponse` (ListingRequirementsService.cs:47-54) |
| 23 | GET | /api/v1/catalog/categories/{id}/attributes | (service only, unused) | ✓ | ✓ | `PublicCategoryAttributesController.cs:14` |
| 24 | GET | /api/v1/catalog/categories/{id}/brands | (service only, unused) | ✓ | ✓ | `PublicCategoryBrandsController.cs:12` |
| 25 | GET | /api/v1/catalog/categories/{id}/conditions | (service only, unused) | ✓ | ✓ | `PublicCategoryConditionController.cs:14` |
| 26 | GET | /api/v1/catalog/categories/{id}/units | (service only, unused) | ✓ | ✓ | `PublicCategoryUnitsController.cs:12` (`:guid`) |
| 27 | GET | /api/v1/catalog/listings/{listingId} | Listing detail | ✓ | ✓ | `CL/PublicListingsController.cs:26` anonymous; bare `PublicListingDetailResponse` (PublicationDtos.cs:274-312); 410 `PublicListingUnavailableResponse`, 404 `{error:"MARKETPLACE_LISTING_NOT_FOUND"}` (PublicListingsController.cs:43-62) — UI branches on 404/410. Image `cdnUrl` points at a non-existent route (backend issue B3) |
| 28 | POST | /api/v1/files/upload-requests | Profile photo, seller documents, listing media | **fixed** | ✓ | `IM/FilesController.cs:32`; `CreateUploadRequest` all fields; server checks size >0 and ≤ max, MIME **and extension** per purpose (FileAssetService.cs:30-39, 55-60). UI only checked size; CHAT/GENERAL limits said `*/*`. Now validates size, MIME and extension locally with the exact server policy |
| 29 | PUT | (presigned S3 URL) | same | ✓ | — | Uses `httpMethod` + `requiredHeaders` from `CreateUploadResponse`; complete re-checks Content-Type/length (FileAssetService.cs:150) |
| 30 | POST | /api/v1/files/{fileId}/complete | same | ✓ | ✓ | `FilesController.cs:47`; optional `If-Match` not needed; `{data:FileAssetResponse}` |
| 31 | GET | /api/v1/files/{fileId} | (service only, unused) | ✓ | ✓ | `FilesController.cs:62` |
| 32 | POST | /api/v1/files/{fileId}/download-url | Profile photo, document/media links | ✓ | ✓ | `FilesController.cs:77`; owner-scoped; `{data:DownloadUrlResponse}` |
| 33 | DELETE | /api/v1/files/{fileId} | (service only, unused) | ✓ | ✓ | `FilesController.cs:92` → 204 |
| 34 | GET | /api/v1/marketplace/actors/me | Auth bootstrap, seller switcher, onboarding | ✓ | ✓ | `UO/Marketplace/MarketplaceActorsController.cs:24`; `MarketplaceCurrentActorResponse` (MarketplaceActorService.cs:34-51) |
| 35 | POST | /api/v1/marketplace/sellers | Seller onboarding | ✓ | ✓ | `MarketplaceSellersController.cs:32`; type INDIVIDUAL/BUSINESS, legalName required for BUSINESS (MarketplaceSellerService.cs:61-78); proc params NVARCHAR(200)/(100), VARCHAR(3) (UO Migrator 024_MarketplaceActorFoundation.sql:48-57) match form limits |
| 36 | GET | /api/v1/marketplace/sellers/{sellerId} | Business page, dashboard | ✓ | ✓ | `MarketplaceSellersController.cs:39`; 403 `{code:"MARKETPLACE_SELLER_ACCESS_DENIED"}` for non-members |
| 37 | POST | /api/v1/marketplace/sellers/{sellerId}/submit | Business page | ✓ | ✓ | `MarketplaceSellersController.cs:49`; `{expectedRowVersion}` 8-byte base64 (MarketplaceSellerService.cs:120-130); UI refetches rowVersion first |
| 38 | GET | /api/v1/marketplace/sellers/{sellerId}/documents | Business page | ✓ | ✓ | `MarketplaceSellerDocumentsController.cs:27`; owner-only (MarketplaceSellerService.cs:177-195) |
| 39 | POST | /api/v1/marketplace/sellers/{sellerId}/documents | Business page (add document) | ✓ | ✓ | `MarketplaceSellerDocumentsController.cs:37`; file must be AVAILABLE `SELLER_DOCUMENT` owned by caller (MarketplaceSellerService.cs:201-202); dates sent as `…T00:00:00Z` |
| 40 | DELETE | /api/v1/marketplace/sellers/{sellerId}/documents/{documentId} | Business page | ✓ | ✓ (workaround) | `MarketplaceSellerDocumentsController.cs:47`; always 404 (backend issue B1) — UI treats 404 as "maybe deleted" and re-reads the list |
| 41 | GET | /api/v1/users/me | Profile, profile photo | ✓ | ✓ | `UO/UsersController.cs:21`; 404 when no profile row (UserProfileService.cs:28-35) → UI shows empty form |
| 42 | PUT | /api/v1/users/me | Profile, profile photo | **fixed** | ✓ | `UsersController.cs:27`; `UpdateUserProfileRequest([Required] DisplayName, …)`; proc params NVARCHAR(200)/(100)/(100), VARCHAR(20)/(100) (UO Migrator 011_UserProfile_ProfileImage.sql:1-9) silently truncate — form had no max lengths, now enforced. UI never sends `profileImageAssetId:null` (backend issue B2) |
| 43 | GET | /api/v1/search/listings | Search, home rails | **fixed** | ✓ | `SD/SearchListingsController.cs:26` anonymous; `SearchListingsRequest` names (SearchListingsContracts.cs:6-25), GUID lists repeated keys, `inStockOnly=true`, lowercase sort. Fixed: page cap (page×pageSize ≤1000, SearchListingsRequestValidator.cs:38 vs `hasNextPage` SearchListingsService.cs:272 — backend issue B4), q ≤200 (validator:97), non-numeric prices no longer sent as `NaN` |
| 44 | GET | /api/v1/search/suggest | Search box | **fixed** | ✓ | `SearchSuggestionsController.cs:25`; prefix 1..100, limit 1..25 (SearchSuggestionsRequestValidator.cs:12-46). Prefix now clipped to 100 |
| 45 | GET | /api/v1/search/saved | Account → saved searches | ✓ | ✓ | `BuyerSavedSearchesController.cs:27` (BuyerPolicy, bearer validated by the service); `remainingQuota` is a computed getter (SavedSearchContracts.cs) and is serialized |
| 46 | POST | /api/v1/search/saved | Search → Save search | **fixed** | ✓ | `BuyerSavedSearchesController.cs:42` → 201 `SavedSearchDto`. Body went through the same validator (SavedSearchCriteriaSerializer.cs:66-90): with a price sort and no currency the UI sent `currency:null` → 400 50904. Now uses the same currency rule as the search request. 409 = limit (SearchDiscoveryException.cs:77) |
| 47 | DELETE | /api/v1/search/saved/{savedSearchId} | Account → saved searches | ✓ | ✓ | `BuyerSavedSearchesController.cs:65` → 204 |
| 48 | GET | /api/v1/marketplace/sellers/{sellerId}/listings | Seller listings, dashboard | ✓ | ✓ | `CL/MarketplaceListingsController.cs:62` query `page,pageSize,status,categoryId,search,sort`; sort whitelist (CL Migrator 025_Stage5A_ListingProcedures.sql:211); `{items,totalCount}` |
| 49 | GET | …/listings/{listingId} | Listing workspace | ✓ | ✓ | `MarketplaceListingsController.cs:78`; `ListingDetailResponse` (ListingDtos.cs) |
| 50 | POST | …/listings | New listing | ✓ | ✓ | `MarketplaceListingsController.cs:45`; `X-Idempotency-Key` required ≤100 (MarketplaceListingService.cs:126) — UI sends a UUID reused for identical retries; title ≤255, currency 3, pricingMode case-sensitive, location all-or-nothing (lines 110-141) mirrored by listing-form.ts |
| 51 | PUT | …/listings/{listingId} | Workspace → details | ✓ | ✓ | `MarketplaceListingsController.cs:89`; full replacement incl. `expectedRowVersion`; returns `{rowVersion}` (line 98) |
| 52 | POST | …/listings/{listingId}/submit | Workspace header, listings table | ✓ | ✓ | `MarketplaceListingsController.cs:101`; `X-Idempotency-Key` required (line 109) but unused by the service; `{listingVersionId, expectedRowVersion}` |
| 53 | GET | …/listings/{listingId}/moderation-status | Listing edit page | ✓ | ✓ | `MarketplaceListingsController.cs:119`; `status` is always the default "DRAFT" for drafts (backend issue B5) — UI does not rely on it |
| 54 | POST | …/listings/{listingId}/validate | Workspace → validate dialog | ✓ | ✓ | `MarketplaceListingAttributesController.cs:62`; `ValidateListingResponse` |
| 55 | POST | …/listings/{listingId}/pause | Workspace header, listings table | ✓ | ✓ | `MarketplaceListingsController.cs:130`; `{remarks?, expectedRowVersion}` (PublicationDtos.cs:118-122) |
| 56 | POST | …/listings/{listingId}/resume | same | ✓ | ✓ | `MarketplaceListingsController.cs:142` |
| 57 | POST | …/listings/{listingId}/archive | same | ✓ | ✓ | `MarketplaceListingsController.cs:154` |
| 58 | GET | …/listings/{listingId}/attributes | Workspace → attributes | ✓ | ✓ | `MarketplaceListingAttributesController.cs:50` |
| 59 | PUT | …/listings/{listingId}/attributes | Workspace → attributes | ✓ | ✓ | `MarketplaceListingAttributesController.cs:37`; value encodings (INTEGER no decimal point, DECIMAL `.`, BOOLEAN true/false, DATE yyyy-MM-dd, option GUIDs) per ListingAttributeService.cs:84-185 match attribute-input.tsx |
| 60 | GET | …/listings/{listingId}/media | Workspace → media | ✓ | ✓ | `ListingMediaController.cs:40` |
| 61 | POST | …/listings/{listingId}/media | Workspace → media | ✓ | ✓ | `ListingMediaController.cs:51`; DOCUMENT must not be primary, file purpose LISTING_IMAGE/LISTING_DOCUMENT (ListingMediaService.cs:72-91) |
| 62 | PUT | …/listings/{listingId}/media/order | Workspace → media | ✓ | ✓ | `ListingMediaController.cs:115`; UI sends every IMAGE id, no dupes (ListingMediaService.cs:186-197) |
| 63 | DELETE | …/listings/{listingId}/media/{fileAssetId} | Workspace → media | ✓ | ✓ | `ListingMediaController.cs:71` — `[FromBody]` JSON body required; client sends it |
| 64 | PUT | …/listings/{listingId}/media/{fileAssetId}/primary | Workspace → media | ✓ | ✓ | `ListingMediaController.cs:93` |
| 65 | GET | …/listings/{listingId}/inventory | Workspace → inventory | ✓ | ✓ | `MarketplaceListingInventoryController.cs:43` |
| 66 | PUT | …/listings/{listingId}/inventory | Workspace → inventory | ✓ | ✓ | `MarketplaceListingInventoryController.cs:54`; reasonCode VARCHAR(50), notes NVARCHAR(500) (CL Migrator 032…Procedures.sql:205-206) match form |
| 67 | POST | …/listings/{listingId}/inventory/adjustments | Workspace → inventory | ✓ | ✓ | `MarketplaceListingInventoryController.cs:81` |
| 68 | GET | …/listings/{listingId}/inventory/movements | Workspace → inventory | ✓ | ✓ | `MarketplaceListingInventoryController.cs:108`; pageSize clamped 1..100 |
| 69 | GET | …/listings/{listingId}/inspections | Workspace → review | ✓ | ✓ | `MarketplaceListingInspectionsController.cs:39`; `PagedInspectionQueueResponse` |
| 70 | GET | …/listings/{listingId}/inspections/latest | Workspace → review | ✓ | ✓ | `MarketplaceListingInspectionsController.cs:52`; empty-body 404 (line 62) → UI returns `null` |
| 71 | POST | …/listings/{listingId}/inspections/{inspectionId}/request-reinspection | Workspace → review | ✓ | ✓ | `MarketplaceListingInspectionsController.cs:68`; `remediationNotes` required non-blank (ListingInspectionService.cs:550) — ReasonDialog requires it; 202 empty body (line 78) |

Errors: every service's error shape is parsed by `src/lib/api/errors.ts` — IA/UO ProblemDetails (`detail`/`title`), CL
`{error,message}` (CL/Api/Filters/MarketplaceExceptionFilterAttribute.cs, model-state → `INVALID_DATA`, CL/Api/Program.cs:34),
IM `{errorCode,message}` (FilesController.cs:107-124), UO marketplace `{code}`, gateway `{code}` (GatewayErrorHandlingMiddleware.cs:104-109),
and — **fixed** — SD `SearchProblemDetailsDto`, whose `errorCode` is numeric and whose symbol is in `errorSymbol`
(SearchListingsContracts.cs, `SearchProblemDetailsDto`); previously `ApiError.code` was always undefined for search errors.

## Fixes made

1. **Search pagination cap** — `src/features/search/lib/search-params.ts` (`maxSearchPage`), `src/features/search/search-page.tsx`:
   page clamped to ⌊1000/24⌋ = 41, "Next" disabled at the cap and the page count capped, because the server rejects page×pageSize > 1000
   (SD SearchListingsRequestValidator.cs:38) while its `hasNextPage` (SearchListingsService.cs:272) still offers page 42.
2. **Saved search currency** — `src/features/search/components/save-search-dialog.tsx` now uses the shared `effectiveCurrency()` rule
   (currency required for price filters/sorts, SearchListingsRequestValidator.cs:71-76, reused by SavedSearchCriteriaSerializer.cs:90).
3. **Search input limits** — q clipped to 200 (validator:97) in search and saved search; suggest prefix clipped to 100
   (`src/services/search.service.ts`, SearchSuggestionsRequestValidator.cs:15,37); non-finite/negative prices are not sent (was `NaN`).
4. **Search error code** — `src/lib/api/errors.ts` reads `errorSymbol` (test added in `src/lib/api/__tests__/errors.test.ts`).
5. **Register displayName ≤100** — `src/features/auth/register-page.tsx` (IA Handlers.cs:98-101).
6. **Profile field lengths** — `src/features/account/profile-page.tsx` max 200/100/100/20/100 (UO 011_UserProfile_ProfileImage.sql:3-7).
7. **Upload validation = server policy** — `src/services/files.service.ts`: `FILE_LIMITS` gains `extensions`; CHAT_ATTACHMENT /
   GENERAL_ATTACHMENT no longer `*/*`; `upload()` rejects empty files, wrong MIME types and wrong extensions locally with the same
   codes the server would return (IM FileAssetService.cs:30-39, 55-60).

## Backend issues (not fixable in UI)

- **B1** `DELETE /api/v1/marketplace/sellers/{id}/documents/{docId}` always answers 404: `PR_SELLER_DOCUMENT_DELETE` uses
  `SET NOCOUNT ON` (UO Migrator 024_MarketplaceActorFoundation.sql:328-336) so `ExecuteAsync` returns -1 and the repository reports
  "not deleted" (UO MarketplaceSellerRepository.cs:175-184 → MarketplaceSellerService.cs:236-237). UI re-reads the list to confirm.
- **B2** `PUT /api/v1/users/me` with `profileImageAssetId:null` deletes the old file (UserProfileService.cs:65-68) but the proc keeps
  the reference (`ISNULL`, 011_UserProfile_ProfileImage.sql:24). UI never sends null and offers no "remove photo".
- **B3** Listing image `cdnUrl` = `/api/v1/files/{id}/download` (CL ListingPublicationService.cs:718, 903) — no such route exists
  (IM FilesController.cs has only `download-url` POST) and `/api/v1/files/*` requires auth at the gateway (GW:38). UI shows a placeholder.
- **B4** Search `hasNextPage` ignores the 1000-result window for the *next* page (SearchListingsService.cs:272 vs validator:38).
- **B5** `moderation-status.status` is always "DRAFT" while a draft exists: `PR_LISTING_GET_BY_ID` does not select the version
  `Status` (CL Migrator 025_Stage5A_ListingProcedures.sql:175) so `ListingVersion.Status` keeps its default (CL Domain/Listings/ListingVersion.cs:10).
- **B6** `POST …/listings/{id}/submit` requires `X-Idempotency-Key` (MarketplaceListingsController.cs:109) but never uses it
  (ListingModerationService.cs:34-86); retries are not deduplicated.
- **B7** user-organization errors expose no machine code (ProblemDetails `title` = ErrorType, `detail` = Message which is unset for
  marketplace errors; BaseApiController.cs:29-33) — the UI maps them by HTTP status.
- **B8** `GET /api/v1/search/listings` binds `attributes[CODE]` both via the `Dictionary` model binder and again in
  `EnrichDynamicAttributeQueryParameters` (SearchListingsController.cs:42-90), which can duplicate values. The UI does not send
  attribute filters since 21 Oct (L13 fixed); duplicated values are harmless because values for one code are OR-ed.
