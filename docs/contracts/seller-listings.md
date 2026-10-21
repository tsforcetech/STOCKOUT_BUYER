# Seller listings API contract (catalog-listing service)

I extracted this from the C# and SQL source in `/home/user/stockout/services/catalog-listing` and did not change that repo. The TypeScript types are in `src/api/types/seller-listings.ts`. The public taxonomy reads are documented in full in `docs/contracts/catalog-taxonomy.md`. Section 9 below only checks them again and summarises them.

Citation prefixes:
- `API/` = `src/Emcore.CatalogListing.Api/`
- `CT/` = `src/Emcore.CatalogListing.Contracts/`
- `APP/` = `src/Emcore.CatalogListing.Application/`
- `INF/` = `src/Emcore.CatalogListing.Infrastructure/`
- `MIG/` = `Emcore.CatalogListing.Migrator/Migrations/Versioned/`
- `GW/` = `/home/user/stockout/gateways/Emcore.ApiGateway/`

Line numbers refer to the files as they currently exist.

---

## 1. Global conventions

### 1.1 Routing and auth
- The gateway route `marketplace-listings-root-route` matches `/api/v1/marketplace/sellers/{sellerId}/listings`. The route `marketplace-listings-child-route` matches `.../listings/{**catch-all}`. Both use `AuthenticatedRoutePolicy` and forward the path unchanged (`GW/appsettings.json:437-454`). `/api/v1/catalog/{**}` is public: route `catalog-listing-route`, `PublicPolicy` (`GW/appsettings.json:115-121`).
- The service authenticates using the `X-User-Id` header that the gateway injects. It maps that header to both the `sub` and `NameIdentifier` claims (`building-blocks/Emcore.BuildingBlocks.Security/SecurityTypes.cs:55-88`).
- Every seller controller has `[Authorize]`. If the header is missing, the service returns **401 with an empty body**. The gateway may rewrite this to problem+json (see `catalog-taxonomy.md` §1.1).
- The attributes controller returns a bare `Unauthorized()` when `sub` is not a GUID (`API/Controllers/MarketplaceListingAttributesController.cs:29-35`). The other controllers throw `UnauthorizedAccessException`, which becomes 401 `{"error":"UNAUTHORIZED","message":"Authentication is required or invalid."}` (`API/Filters/MarketplaceExceptionFilterAttribute.cs:24-35`).

### 1.2 Seller authorization
Every seller action first calls user-organization `GET /api/internal/marketplace/sellers/{sellerId}/validate?userId={callerUserId}` (`INF/Integrations/Sellers/SellerValidationClient.cs:22-61`).

What that call returns:
- `canOperate` is true only when **all** of these hold (`services/user-organization/.../MarketplaceActorService.cs:56-58`):
  - the caller is the **owner** member,
  - the membership is `ACTIVE`,
  - the seller org `status` is `ACTIVE`.
- A user who is not a member gets 200 `{valid:false}`.

In practice this means **only the OWNER of an ACTIVE seller can use any of these endpoints, including create draft and read**.

How each group reports a failed check:

| Endpoint group | Check | Denied | Dependency down |
|---|---|---|---|
| create, list, detail, update (`APP/Listings/MarketplaceListingService.cs:55-67`); attributes GET/PUT (`APP/Listings/ListingAttributeService.cs:33-40`); validate (`APP/Listings/ListingValidationService.cs:35-43`); media (`APP/Listings/ListingMediaService.cs:31-43`); inventory (`APP/Inventory/ListingInventoryService.cs:25-43`); inspections (`APP/Inspections/ListingInspectionService.cs:34-46`) | `valid && sellerId==route && relationship=="OWNER" && canOperate` | 403 `MARKETPLACE_SELLER_ACCESS_DENIED` | 503 `MARKETPLACE_LISTING_DEPENDENCY_UNAVAILABLE` |
| submit (`APP/Moderation/ListingModerationService.cs:48-56`); pause, resume, archive (`APP/Publication/ListingPublicationService.cs:389-397,435-443,504-516`) | `valid && canOperate` | 403 `MARKETPLACE_SELLER_NOT_AUTHORIZED` | 503 `SERVICE_UNAVAILABLE` |
| moderation-status (`ListingModerationService.cs:94-102`) | `valid` only | 403 `MARKETPLACE_SELLER_NOT_AUTHORIZED` | 503 `SERVICE_UNAVAILABLE` |

After this check, the stored procedure confirms that the **listing belongs to `sellerId`**. The error code for a mismatch depends on the endpoint:
- detail, update, attributes, validate, moderation-status: `PR_LISTING_GET_BY_ID` returns 403 `MARKETPLACE_LISTING_ACCESS_DENIED` (`MIG/025:163-166`, `INF/Repositories/Listings/ListingRepository.cs:31-46`)
- media and inventory: 403 `MARKETPLACE_SELLER_ACCESS_DENIED` (`MIG/030`, `MIG/032`)
- submit, pause, resume, archive: **409** `MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID` (`MIG/036`, `INF/Repositories/Listings/MarketplaceSqlExceptionMapper.cs:32-35`). Resume returns **403** with the same code from C# instead (`ListingPublicationService.cs:461-464`).
- inspections: 403 `MARKETPLACE_INSPECTION_ACCESS_DENIED`

### 1.3 JSON
- There is no `AddJsonOptions` (`API/Program.cs:31-42`), so the System.Text.Json web defaults apply:
  - Properties are written in **camelCase** and input matching is case-insensitive.
  - Nulls are written as `null`.
  - `decimal` values are JSON numbers. They keep their SQL scale, for example `100.0000`.
  - `Guid` values are strings.
- No C# enums are serialized. Every status is a string constant, listed in §2.
- `DateTime` values read from SQL `datetime2` have `Kind=Unspecified`. They serialize **without `Z`**, for example `"2026-10-17T10:00:00.1234567"`. Treat them as UTC.
- Send input datetimes with `Z`.
- `rowVersion` and `expectedRowVersion` are a **base64 string of an 8-byte SQL `rowversion`**, for example `"AAAAAAAAB9E="`.

### 1.4 Envelope (seller endpoints are not wrapped)
- Seller endpoints and `GET /api/v1/catalog/listings/{id}` return the **bare DTO**. There is no `{success,data}` wrapper, because the controllers return `Ok(dto)`.
- The public taxonomy endpoints (§9) do use `{"success":true,"data":...}`.
- The error body is always `{"error":"<CODE>","message":"<text>"|null}` (`CT/Responses/ApiResponse.cs:9-13`). For SQL-raised errors the `message` is usually the code itself or a fixed sentence. **Branch on `error`, not on `message`.**
- Unhandled exceptions return 500 `{"error":"INTERNAL_SERVER_ERROR","message":"An unexpected error occurred processing your request."}`. Unknown SQL error numbers return 500 `MARKETPLACE_LISTING_INTERNAL_ERROR`.

### 1.5 Model validation
Model validation fails in these cases:
- malformed JSON
- a missing body on `[FromBody]`
- a wrong JSON type, such as a non-GUID in a Guid field
- a **null, empty or whitespace-only value in any non-nullable `string` property**

The last case applies because `<Nullable>enable</Nullable>` makes MVC add an implicit `[Required]` (`/home/user/stockout/Directory.Build.props:4`). The same rule very likely applies to the non-nullable `[FromHeader] string idempotencyKey` parameter.

Every one of these failures returns **400 `{"error":"INVALID_DATA","message":"Validation failed"}`** (`API/Program.cs:31-42`). This happens **before** the service's own checks, so several service-level codes cannot be reached in practice. Those cases are flagged per endpoint.

Fields affected by the implicit `[Required]`:
- `title`, `pricingMode` and `currency` on create and update
- `location.countryCode`, `location.stateOrEmirate` and `location.city` **when `location` is not null**
- every `expectedRowVersion` whose type is `string` rather than `string?`
- `mediaType`
- `remediationNotes`

DELETE `.../media/{fileAssetId}` has a `[FromBody]`, so **always send `Content-Type: application/json` and a body**.

### 1.6 Concurrency: three independent row versions
| Token | Owner | Returned by | Used by |
|---|---|---|---|
| **Listing `rowVersion`** (`LISTING.RowVersion`) | listing aggregate | create, detail, update, attributes GET/PUT, media GET/POST/DELETE/PUT, submit, pause, resume, archive | `expectedRowVersion` on update, attributes PUT, all media mutations, submit, pause, resume, archive |
| **Inventory `rowVersion`** (`LISTING_INVENTORY.RowVersion`) | inventory row | inventory GET/PUT/POST | inventory PUT (if a row exists) and adjustments |
| Inspection `rowVersion` | inspection | inspection reads | not used by sellers |

Every listing mutation bumps the listing `rowVersion`. Moderation decisions by an admin also bump it (`MIG/036:896-899`).

**After each mutation, replace your stored token with the returned `rowVersion`.** A mismatch returns 409 `MARKETPLACE_LISTING_VERSION_CONFLICT`, or `MARKETPLACE_INVENTORY_VERSION_CONFLICT` for inventory.

Inventory mutations do **not** bump the listing `rowVersion`. Buyer reservations do bump the inventory `rowVersion`, so expect inventory 409s and re-fetch when you get one.

### 1.7 Idempotency (`X-Idempotency-Key`)
Only two endpoints read this header:

| Endpoint | Required | Replay semantics |
|---|---|---|
| `POST .../listings` (create) | Yes. A missing or blank key returns 400 `INVALID_DATA`. A key longer than 100 characters returns 400 `INVALID_DATA` "IdempotencyKey required and max 100 chars" (`API/Controllers/MarketplaceListingsController.cs:52-55`, `APP/Listings/MarketplaceListingService.cs:126-129`) | The key is scoped to `(sellerId, callerUserId, key)` (`MIG/025:33-64`). The same key and same body return **200 with the listing's *current* `listingId/currentDraftVersionId/versionNumber/status/rowVersion`**. This is not a stored snapshot. The same key with a different body (SHA-256 over the canonical fields, `MarketplaceListingService.cs:374-399`) returns **409 `MARKETPLACE_LISTING_IDEMPOTENCY_CONFLICT`**. The row stores `ExpiresAtUtc = +30 days` but nothing ever checks it, so in effect the key is kept forever |
| `POST .../{listingId}/submit` | Yes. A missing or blank key returns 400 `INVALID_DATA` (`MarketplaceListingsController.cs:109-112`). There is no length check | **The key is ignored.** It is never passed to the repository (`ListingModerationService.cs:70-76`). A retry after success returns 409, either `MARKETPLACE_LISTING_VERSION_CONFLICT` (stale rowVersion) or `MARKETPLACE_LISTING_TRANSITION_INVALID` |

No other seller endpoint reads an idempotency key. All other mutations are protected only by `expectedRowVersion`.

---

## 2. Enumerations (exact strings)

| Name | Values | Source |
|---|---|---|
| Listing `status` (aggregate) | `DRAFT` `PUBLISHED` `SUSPENDED` `EXPIRED` `ARCHIVED` | `src/Emcore.CatalogListing.Domain/Listings/ListingStatus.cs` |
| Version status | `DRAFT` `UNDER_REVIEW` `CHANGES_REQUIRED` `APPROVED` `INSPECTION_REQUIRED` `REJECTED` `PUBLISHED` `SUPERSEDED` `ARCHIVED` | `Domain/Listings/ListingVersionStatus.cs` |
| `pricingMode` | `FIXED_PRICE` `BIDDING` `BOTH` (case-sensitive) | `MarketplaceListingService.cs:131` |
| Moderation `decision` | `APPROVE` `REQUEST_CHANGES` `REJECT` | `Domain/Moderation/ModerationDecision.cs` |
| Media `mediaType` | `IMAGE` `DOCUMENT` (the input is trimmed and uppercased) | `ListingMediaService.cs:72-76`, `MIG/029` CHECK |
| Suspension reason (seller pause) | `SELLER_REQUESTED_PAUSE`. Admin reasons: `ADMINISTRATIVE_SUSPENSION` `POLICY_VIOLATION` `COUNTERFEIT_INVESTIGATION` `SELLER_ACCOUNT_SUSPENDED` `ADMINISTRATIVE_HOLD` | `Domain/Publication/SuspensionReasonCode.cs` |
| Inventory `movementType` | `INITIAL` `MANUAL_SET` `MANUAL_INCREASE` `MANUAL_DECREASE` `RESERVATION_CREATED` `RESERVATION_RELEASED` `RESERVATION_CONSUMED` `RESERVATION_EXPIRED_BATCH` | `MIG/032` |
| Inventory `referenceType` (seller rows) | `INITIAL_STOCK` `SELLER_SET` `SELLER_ADJUSTMENT` `RESERVATION_EXPIRY_BATCH`. Reservation rows carry the caller's own value | `MIG/032` |
| Inspection `status` / `result` | `PENDING` `ASSIGNED` `IN_PROGRESS` `COMPLETED` `CANCELLED` / `PASS` `FAIL` `REINSPECTION_REQUIRED` | `MIG/033:113-114` |
| Inspection item `itemResult` | `PASS` `FAIL` `NOT_APPLICABLE` | `MIG/033:163` |
| Attribute `dataType` | `TEXT` `INTEGER` `DECIMAL` `BOOLEAN` `DATE` `SINGLE_SELECT` `MULTI_SELECT` | `ListingAttributeService.cs:158-186` |

**Inventory reason codes are not an enum.** `reasonCode` is free text. The SQL parameter is `VARCHAR(50)` and any longer value is **silently truncated** (`MIG/032:205`). The value is never validated.

---

## 3. Listing CRUD and lifecycle (`API/Controllers/MarketplaceListingsController.cs`, route `api/v1/marketplace/sellers/{sellerId:guid}/listings`, L16)

### L1. `POST /listings`: create draft (L45-60)
Headers: `X-Idempotency-Key` is required (§1.7).

Body: `CreateListingDraftRequest` (`CT/Listings/ListingDtos.cs:6-27`)
```json
{ "categoryId": "guid", "title": "string", "pricingMode": "FIXED_PRICE|BIDDING|BOTH", "currency": "AED",
  "description": "string|null", "basePrice": 0, "brandId": "guid|null", "conditionId": "guid|null",
  "gradeId": "guid|null", "quantityUnitId": "guid|null",
  "location": { "countryCode": "AE", "stateOrEmirate": "Dubai", "city": "Dubai" } | null,
  "expiresAtUtc": "2026-12-31T00:00:00Z" | null }
```

Validation runs in this order (`MarketplaceListingService.cs:106-147`):

| Field | Rule | Error |
|---|---|---|
| `title` | not blank, at most 255 characters | 400 `INVALID_DATA` |
| `currency` | not blank, exactly 3 characters. It is uppercased; no ISO list is checked | 400 `MARKETPLACE_LISTING_CURRENCY_INVALID` |
| `basePrice` | must be >= 0. Zero is allowed for a draft, but **submit requires > 0**. The column is DECIMAL(19,4), so extra decimals are rounded by SQL | 400 `MARKETPLACE_LISTING_PRICE_INVALID` |
| idempotency key | at most 100 characters | 400 `INVALID_DATA` |
| `pricingMode` | not in the enum | 400 **`MARKETPLACE_LISTING_PRICE_INVALID`** (there is no dedicated code) |
| `location` | all three fields or none | 400 `MARKETPLACE_LISTING_LOCATION_INVALID`. In practice a missing field becomes `INVALID_DATA` (§1.5). The DB columns are `countryCode` VARCHAR(10), `stateOrEmirate` and `city` NVARCHAR(100); longer values are silently truncated |
| `categoryId` | must exist. **It is not checked for being active or a leaf** | 400 `MARKETPLACE_LISTING_CATEGORY_INVALID` |
| `brandId` / `conditionId` / `gradeId` / `quantityUnitId` | must exist **only**. Category applicability is not checked here (see L7 validate) | 400 `MARKETPLACE_LISTING_BRAND_INVALID` / `_CONDITION_INVALID` / `_GRADE_INVALID` / `_UNIT_INVALID` |
| `expiresAtUtc` | no validation. A past date makes the listing expire right after publish | – |
| `description` | no limit (NVARCHAR(MAX)) | – |

Success: **200** (not 201) with `CreateListingDraftResponse`:
```json
{"listingId","currentDraftVersionId","versionNumber":1,"status":"DRAFT","rowVersion"}
```
The listing `status` is `DRAFT` and version 1 is `DRAFT` (`MIG/025:69-138`).

### L2. `GET /listings`: list (L62-76)
Query parameters:

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | 1 | Values below 1 become 1 |
| `pageSize` | int | 20 | Values below 1 become 20. **There is no upper bound** |
| `status` | string? | – | Exact match on the **listing** status (§2). It is not validated; an unknown value returns empty results |
| `categoryId` | Guid? | – | Matches the category of the current draft version, or of the published version if there is no draft |
| `search` | string? | – | `Title LIKE '%'+search+'%'`. Wildcards are not escaped. The value is truncated to 255 |
| `sort` | string | `CreatedAtUtcDesc` | One of `CreatedAtUtcDesc`, `CreatedAtUtcAsc`, `TitleAsc`, `TitleDesc`. Anything else falls back to the default. `listingId` breaks ties |

These rules come from `MIG/025:193-252`.

Response: `SellerListingListResponse` `{ "items": SellerListingListItemResponse[], "totalCount": int }` (`CT/Listings/ListingDtos.cs:85-102`). The page and page size are **not echoed**.

Each item has these fields:
- `listingId`, `sellerId`, `status`
- `currentDraftVersionId?`, `publishedVersionId?`
- `createdAtUtc`, `updatedAtUtc?`
- `title`, `categoryId` (taken from the draft version, or from the published version if there is no draft)

Items include no price, image, inventory or version status.

### L3. `GET /listings/{listingId}`: detail (L78-87)
Response: `ListingDetailResponse` (`CT/Listings/ListingDtos.cs:55-83`)
```json
{"listingId","sellerId","status","currentDraftVersionId":null|guid,"publishedVersionId":null|guid,
 "expiresAtUtc":null|dt,"rowVersion",
 "currentDraftVersion": ListingVersionDto|null, "publishedVersion": ListingVersionDto|null}
```
`ListingVersionDto` has these fields:
- `listingVersionId`, `versionNumber`, `categoryId`, `title`, `description?`
- `pricingMode`, `currency`, `basePrice`
- `brandId?`, `conditionId?`, `gradeId?`, `quantityUnitId?`
- `location?` `{countryCode, stateOrEmirate, city}`

It has **no version `status`, no timestamps and no `requiresPhysicalInspection`**. `PR_LISTING_GET_BY_ID` does not select `LISTING_VERSION.Status` (`MIG/025:174-188`).

Errors:
- 404 `MARKETPLACE_LISTING_NOT_FOUND`
- 403 `MARKETPLACE_LISTING_ACCESS_DENIED`: the listing belongs to another seller

### L4. `PUT /listings/{listingId}`: update the current draft (L89-99)
Body: `UpdateListingDraftRequest`. It has the same fields as create plus a required `"expectedRowVersion"` (`CT/Listings/ListingDtos.cs:38-53`).

This is a **full replacement** of the draft version:
- `description`, `brandId`, `conditionId`, `gradeId`, `quantityUnitId` and `expiresAtUtc` are overwritten. Sending `null` clears them.
- `location: null` deletes the location (`MIG/032:1367-1394`).

Validation is the same as create, plus these `expectedRowVersion` checks (`MarketplaceListingService.cs:261-372`):
- required
- valid base64
- exactly 8 bytes

Any of those failures returns 400 `INVALID_DATA`.

Preconditions, checked in order:

| # | Precondition | Failure |
|---|---|---|
| 1 | The listing has a `currentDraftVersionId` | 409 `MARKETPLACE_LISTING_TRANSITION_INVALID` |
| 2 | The listing belongs to `sellerId` | 409 `MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID` |
| 3 | `rowVersion` matches | 409 `MARKETPLACE_LISTING_VERSION_CONFLICT` |
| 4 | The **listing** status is `DRAFT` or `CHANGES_REQUIRED` | 409 `MARKETPLACE_LISTING_TRANSITION_INVALID`. In practice only `DRAFT` qualifies, because the listing status is never `CHANGES_REQUIRED` (`MIG/032:1317`) |
| 5 | The quantity unit is unchanged, or the listing has no stock (on hand and reserved both 0) | 409 `MARKETPLACE_INVENTORY_UNIT_CHANGE_BLOCKED` |

Side effect: **changing `categoryId` deletes all of the draft's attribute values** (`MIG/032:1339-1349`).

Success: 200 `{"rowVersion":"..."}` (L98).

### L5. `POST /listings/{listingId}/submit`: submit for review (L101-117)
Headers: `X-Idempotency-Key` is required but ignored (§1.7).

Body: `SubmitListingRequest` `{ "listingVersionId": "guid", "expectedRowVersion": "b64" }` (`CT/Moderation/ModerationDtos.cs:6-10`).

`listingVersionId` must equal `currentDraftVersionId`. A non-base64 `expectedRowVersion` returns 400 **`INVALID_ROW_VERSION`**. There is no length check here.

Preconditions, from `PR_LISTING_SUBMIT` (`MIG/036:440-596`):

| # | Precondition | Failure |
|---|---|---|
| 1 | The listing exists | 404 `MARKETPLACE_LISTING_NOT_FOUND` |
| 2 | The listing belongs to `sellerId` | 409 `MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID` |
| 3 | `rowVersion` matches | 409 `MARKETPLACE_LISTING_VERSION_CONFLICT` |
| 4 | The version exists on this listing | 404 `MARKETPLACE_LISTING_VERSION_NOT_FOUND` |
| 5 | The version is the current draft | 409 `MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID` |
| 6 | The version status is `DRAFT` or `CHANGES_REQUIRED` (L510) | 409 `MARKETPLACE_LISTING_TRANSITION_INVALID` |
| 7 | `basePrice > 0` and `pricingMode` is set (L516) | 409 `MARKETPLACE_LISTING_NOT_READY_FOR_SUBMISSION` |
| 8 | At least one media row exists (L522). **A DOCUMENT counts** | 409 `MARKETPLACE_LISTING_NOT_READY_FOR_SUBMISSION` |

Submit does **not** check required attributes, inventory, or category applicability, so run L7 validate first.

Success: 200 `SubmitListingResponse`:
```json
{"listingId","listingVersionId","status":"UNDER_REVIEW","submittedAtUtc","rowVersion"}
```
The `status` here is the **version** status. The listing status stays as it was.

### L6. `GET /listings/{listingId}/moderation-status` (L119-128)
Response: `ListingModerationStatusResponse` (`CT/Moderation/ModerationDtos.cs:156-165`)
```json
{"listingId","listingVersionId","status","reviewedAtUtc":null|dt,"decision":null|"APPROVE|REQUEST_CHANGES|REJECT","reasonCode":null|str,"sellerNotes":null|str}
```
- `listingVersionId` is the current draft id, or **`00000000-0000-0000-0000-000000000000`** when there is no draft (`ListingModerationService.cs:113`).
- `status` was meant to be the draft version status, falling back to the listing status. It is **broken** (see defect D1): when a draft exists it is always `"DRAFT"`.
- `decision`, `reasonCode` and `sellerNotes` come from the **latest moderation record for the listing**, which may belong to an older version (`MIG/036:1965-1986`).
- `internalNotes` is never exposed.

### L7. `POST /listings/{listingId}/validate` (`API/Controllers/MarketplaceListingAttributesController.cs:62-72`)
There is no body. The route has no `:guid` constraint, so a non-GUID value returns 400 `INVALID_DATA`.

It returns 404 `MARKETPLACE_LISTING_NOT_FOUND` if there is no current draft.

Response: 200 `ValidateListingResponse`:
```json
{"listingId","listingVersionId","isValid":bool,"errors":[{"code","field","attributeDefinitionId":null|guid,"message"}]}
```
(`CT/Listings/ListingAttributeDtos.cs:28-42`, `APP/Listings/ListingValidationService.cs:33-157`)

The result is **advisory only**. Submit does not run it.

`field` takes one of these values:
- `title`, `pricingMode`, `currency`, `basePrice`
- `brandId`, `unitId`, `conditionId`, `gradeId`
- `attributes`, `attributes.{attributeDefinitionId}`
- `system`

`code` takes one of these values:
- `MARKETPLACE_LISTING_TITLE_REQUIRED`
- `MARKETPLACE_LISTING_PRICING_MODE_INVALID`
- `MARKETPLACE_LISTING_CURRENCY_INVALID`
- `MARKETPLACE_LISTING_PRICE_INVALID`
- `MARKETPLACE_LISTING_BRAND_INVALID`
- `MARKETPLACE_LISTING_UNIT_INVALID`
- `MARKETPLACE_LISTING_CONDITION_INVALID`
- `MARKETPLACE_LISTING_GRADE_INVALID`
- `MARKETPLACE_LISTING_ATTRIBUTE_NOT_ALLOWED`
- `MARKETPLACE_LISTING_REQUIRED_ATTRIBUTE_MISSING`
- `MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID`
- `MARKETPLACE_LISTING_ATTRIBUTE_DUPLICATE`
- `MARKETPLACE_LISTING_ATTRIBUTE_OPTION_INVALID`
- `MARKETPLACE_LISTING_VALIDATION_FAILED`. This one is the fallback, and it is also used when the category requirements cannot be loaded, for example because the category is inactive.

The checks run against `GET /catalog/categories/{id}/listing-requirements` and cover these rules (`APP/Validation/CategoryListingValidator.cs`):
- brand applicability
- unit applicability
- condition required and allowed
- grade required and mapped
- attribute required
- text min/max length and regex
- integer and decimal min/max
- decimal precision
- option validity

**Quantity is never validated**, because `Quantity = null` (`ListingValidationService.cs:82`).

### L8. `POST /listings/{listingId}/pause` (L130-140)
Body: `SellerPauseListingRequest` `{ "remarks": "string|null", "expectedRowVersion": "b64" }` (`CT/Publication/PublicationDtos.cs:118-122`).

`PR_LISTING_SUSPEND` checks the following (`MIG/036:1469-1575`):
- The listing is **effectively PUBLISHED**: status `PUBLISHED` and not past `expiresAtUtc`. Otherwise it returns 409 `MARKETPLACE_LISTING_NOT_PUBLISHED`.
- Ownership: 409 `MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID`.
- Row version: 409 `MARKETPLACE_LISTING_VERSION_CONFLICT`.
- Not found: 404.
- A non-base64 `expectedRowVersion` returns 400 `INVALID_ROW_VERSION`.

The listing then moves to `SUSPENDED` with reason `SELLER_REQUESTED_PAUSE`. **"Paused" is not a separate status.**

Success: 200 `SuspendListingResponse`:
```json
{"listingId","status":"SUSPENDED","reasonCode":"SELLER_REQUESTED_PAUSE","updatedAtUtc","rowVersion"}
```

### L9. `POST /listings/{listingId}/resume` (L142-152)
Body: `{ "expectedRowVersion": "b64" }`.

Checks run in this order (`ListingPublicationService.cs:422-489`, `MIG/036:1579-1749`):

| # | Check | Failure |
|---|---|---|
| 1 | The seller is ACTIVE, VERIFIED and onboarding COMPLETED | 409 `MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION` |
| 2 | The listing has a published version | 404 or 409 `MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION` |
| 3 | Ownership (checked in C#) | 403 `MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID` |
| 4 | The primary IMAGE file is validated with inventory-media (see defect D3) | 409 `MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION` |
| 5 | SQL: status is `SUSPENDED` and not expired | 409 `MARKETPLACE_LISTING_TRANSITION_INVALID` |
| 6 | SQL: the **latest** suspension reason is `SELLER_REQUESTED_PAUSE` (L1643) | **403 `MARKETPLACE_SELLER_RESUME_BLOCKED`** (the listing was suspended by an admin) |
| 7 | SQL: sellable quantity > 0, and the published version has a primary IMAGE | 409 `MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION` |
| 8 | SQL: if the version requires inspection, a COMPLETED/PASS inspection exists | 409 `MARKETPLACE_LISTING_INSPECTION_NOT_PASSED` |

Success: 200 `RepublishListingResponse`:
```json
{"listingId","publishedVersionId","status":"PUBLISHED","updatedAtUtc","rowVersion"}
```

### L10. `POST /listings/{listingId}/archive` (L154-164)
Body: `{ "expectedRowVersion": "b64" }`.

The seller must also have `status == "ACTIVE"`. Otherwise the response is 403 `MARKETPLACE_SELLER_NOT_AUTHORIZED` (`ListingPublicationService.cs:513-516`).

`PR_LISTING_ARCHIVE` checks the following (`MIG/036:1838-1960`):
- An **effectively PUBLISHED** listing cannot be archived (L1889) and returns 409 `MARKETPLACE_LISTING_TRANSITION_INVALID`. **Pause it first.**
- Any `reservedQuantity > 0` (L1897) returns 409 `MARKETPLACE_LISTING_RESERVATION_ACTIVE`.

Every other status can be archived, **including `ARCHIVED` itself** (see defect D9).

Archiving sets the current draft version (if any) to `ARCHIVED`. ARCHIVED is **terminal**: there is no unarchive endpoint.

Success: 200 `ArchiveListingResponse` `{"listingId","status":"ARCHIVED","updatedAtUtc","rowVersion"}`.

---

## 4. Attributes (`API/Controllers/MarketplaceListingAttributesController.cs`, route `.../listings/{listingId}` with no `:guid` constraint)

### A1. `GET /listings/{listingId}/attributes` (L50-60)
This reads the **current draft only**. If there is no draft it returns 409 `MARKETPLACE_LISTING_TRANSITION_INVALID`.

Response: `ListingAttributesResponse` (`CT/Listings/ListingAttributeDtos.cs:13-26`):
```json
{"listingId","listingVersionId","rowVersion":"<listing rowVersion>","attributes":[{"attributeDefinitionId","dataType","values":["..."]}]}
```
Values are strings, encoded per `dataType` (`APP/Listings/ListingAttributeService.cs:222-281`):

| `dataType` | Encoding |
|---|---|
| TEXT | the raw text |
| INTEGER | `"123"` |
| DECIMAL | invariant `G` format, for example `"12.5000"`. The column is DECIMAL(28,4) |
| BOOLEAN | `"true"` or `"false"` |
| DATE | `"yyyy-MM-dd"` |
| SINGLE_SELECT | `[optionId]` |
| MULTI_SELECT | `[optionId, ...]` |

### A2. `PUT /listings/{listingId}/attributes` (L37-48)
This **replaces the full set** for the current draft.

Body:
```json
{"expectedRowVersion":"b64","attributes":[{"attributeDefinitionId":"guid","values":["string", ...]}]}
```
(`CT/Validation/ListingSubmissionDto.cs:6-10`)

Input rules (`ListingAttributeService.cs:42-220`):
- `attributeDefinitionId` must be in the category's **effective schema** (`GET /catalog/categories/{categoryId}/attributes`). Otherwise the response is 400 `MARKETPLACE_LISTING_ATTRIBUTE_NOT_ALLOWED`. If the category schema cannot be loaded, for example because the category is inactive, the response is 404 `MARKETPLACE_LISTING_SCHEMA_NOT_FOUND`.
- A duplicate `attributeDefinitionId` returns 400 `MARKETPLACE_LISTING_ATTRIBUTE_DUPLICATE`.
- `values` is trimmed and blank entries are dropped. An empty or null `values` list means the attribute is **not stored**.
- Every data type except MULTI_SELECT accepts at most one value. More returns 400 `MARKETPLACE_LISTING_ATTRIBUTE_CARDINALITY_INVALID`.

Per-type rules:

| `dataType` | Rule | Error |
|---|---|---|
| SINGLE_SELECT, MULTI_SELECT | Each value must be the GUID of an **active** option of that attribute | 400 `MARKETPLACE_LISTING_ATTRIBUTE_OPTION_INVALID` |
| MULTI_SELECT | Duplicate options | 400 `MARKETPLACE_LISTING_ATTRIBUTE_DUPLICATE` |
| INTEGER | Optional sign and digits only. No decimal point or exponent, and the value must be whole | 400 `MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID` |
| DECIMAL | Optional sign and `.`. No exponent and no thousands separator. SQL rounds to 4 decimal places | 400 `MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID` |
| BOOLEAN | `true` or `false`, case-insensitive (`bool.TryParse`) | 400 `MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID` |
| DATE | exactly `yyyy-MM-dd` | 400 `MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID` |
| TEXT | any value | – |

**Min/max/length/regex and `isRequired` are not enforced here.** Only L7 validate checks them.

Row version (`INF/Repositories/ListingAttributeRepository.cs:38-51`): a missing value, invalid base64, or a value that is not 8 bytes returns 400 `MARKETPLACE_LISTING_ROW_VERSION_INVALID`. In practice a missing value triggers `INVALID_DATA` first (§1.5).

Errors from `PR_LISTING_ATTRIBUTE_REPLACE` (`MIG/027:1-243`, mapped at `ListingAttributeRepository.cs:72-92`):
- 404 `MARKETPLACE_LISTING_NOT_FOUND`: there is no draft. The C# check returns the same code first (`ListingAttributeService.cs:47-48`).
- 409 `MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID`
- 409 `MARKETPLACE_LISTING_VERSION_CONFLICT`
- 409 `MARKETPLACE_LISTING_TRANSITION_INVALID`: the **listing** status is not `DRAFT` (L51)
- 400 `MARKETPLACE_LISTING_ATTRIBUTE_DUPLICATE`, `_OPTION_INVALID` or `_VALUE_INVALID`
- 400 `MARKETPLACE_LISTING_BAD_REQUEST`, 409 `MARKETPLACE_LISTING_CONFLICT`: generic fallbacks

Success: 200 `ListingAttributesResponse`. This is the A1 shape **re-read**, with `rowVersion` set to the new listing rowVersion.

---

## 5. Media (`API/Controllers/ListingMediaController.cs`, route `.../listings/{listingId:guid}/media`, L15)

### How media links to `/api/v1/files`
1. Upload through inventory-media:
   - `POST /api/v1/files/upload-requests` with `purpose: "LISTING_IMAGE"` for an IMAGE or `"LISTING_DOCUMENT"` for a DOCUMENT.
   - PUT the bytes to the signed URL.
   - `POST /api/v1/files/{fileId}/complete`.
2. The file must be in status `AVAILABLE`, have `purpose` equal to the purpose matching `mediaType`, and have **`OwnerUserId` equal to the calling user's id** (`APP/Listings/ListingMediaService.cs:87-92`, `services/inventory-media/.../001_FileAssetFoundation.sql:301-313`). If any of these fails, the response is 409 `MARKETPLACE_LISTING_MEDIA_INVALID`. If the files service is down, the response is 503 `MARKETPLACE_LISTING_DEPENDENCY_UNAVAILABLE`.
3. Purpose policies (`services/inventory-media/src/Emcore.InventoryMedia.Application/Services/FileAssetService.cs:32-34`):
   - `LISTING_IMAGE`: `image/jpeg`, `image/png`, `image/webp`, at most 10 MiB
   - `LISTING_DOCUMENT`: `application/pdf`, `image/jpeg`, `image/png`, at most 20 MiB
4. In every endpoint below, `fileAssetId` is the files-service `fileId`.

Media mutations always target the **current draft version**; with no draft they return 409 `MARKETPLACE_LISTING_TRANSITION_INVALID`. `GET …/media` reads the current draft version, or the **published version when there is no draft** (migration `045_F2B_PublishedListingMediaGetProcedure.sql`, backend `9471971`, verified live 21 Oct). It still returns 409 only when the listing has neither. The seller portal shows that media read-only.

The SQL allows mutation when the listing status is `DRAFT`, `CHANGES_REQUIRED` or `PUBLISHED` (`MIG/030:65,273,398,492`). **The version status is not checked**, so media can change while a version is `UNDER_REVIEW` or `APPROVED`.

Row version (`ListingMediaService.cs:45-65`): a missing value, invalid base64, or a value that is not 8 bytes returns 400 `MARKETPLACE_LISTING_ROW_VERSION_INVALID`.

Common SQL errors (`INF/Repositories/Listings/ListingMediaRepository.cs:24-125`):
- 404 `MARKETPLACE_LISTING_NOT_FOUND`
- 403 `MARKETPLACE_SELLER_ACCESS_DENIED`
- 409 `MARKETPLACE_LISTING_TRANSITION_INVALID`
- 409 `MARKETPLACE_LISTING_VERSION_CONFLICT`

Item shape `ListingMediaItemResponse` (`CT/Listings/ListingMediaDtos.cs:26-34`):
```json
{"listingVersionMediaId","fileAssetId","mediaType":"IMAGE|DOCUMENT","displayOrder":int,"isPrimary":bool,"documentType":null|str}
```

### M1. `GET /media` (L40-49)
Response: `ListingMediaResponse` `{"listingId","listingVersionId","rowVersion","media":[item...]}`.

Ordering: IMAGEs first, then by `displayOrder`, then by `fileAssetId` (`MIG/030:170-224`). The response includes **no URLs**. Fetch download URLs from the files service separately.

### M2. `POST /media`: attach (L51-69)
Body: `AttachListingMediaRequest` (`CT/Listings/ListingMediaDtos.cs:6-13`):
```json
{"expectedRowVersion","fileAssetId","mediaType":"IMAGE|DOCUMENT","isPrimary":bool,"documentType":null|str}
```

| Rule | Failure |
|---|---|
| `mediaType` is `IMAGE` or `DOCUMENT` | 400 `MARKETPLACE_LISTING_MEDIA_TYPE_INVALID` |
| A DOCUMENT is not sent with `isPrimary: true` | 400 `MARKETPLACE_LISTING_PRIMARY_IMAGE_INVALID` |
| Fewer than the maximum images or documents are already attached. The defaults are **10 images and 10 documents**, overridable by the platform settings `listing.media.max-images` and `listing.media.max-documents`; any failure falls back to 10 (`INF/Integrations/Media/PlatformConfigurationClient.cs:22-68`) | 409 `MARKETPLACE_LISTING_MAX_IMAGES_EXCEEDED` / `_MAX_DOCUMENTS_EXCEEDED` |
| The same file is not already attached to this version | 409 `MARKETPLACE_LISTING_MEDIA_ALREADY_ATTACHED` |

Other behaviour:
- `documentType` is free text with no validation. It is VARCHAR(100), so longer values are silently truncated.
- **The first IMAGE is always primary.** A later image with `isPrimary:true` takes over the primary flag (`MIG/030:103-118`).
- `displayOrder` is the maximum for that media type plus 1.

Success: 200 `AttachListingMediaResponse` `{"listingId","listingVersionId","fileAssetId","rowVersion","association": item}`.

### M3. `PUT /media/order` (L115-133)
Body: `{"expectedRowVersion","orderedFileAssetIds":["guid", ...]}`.

The list must be non-empty, contain no empty GUIDs and no duplicates, and contain **exactly the full set of IMAGE fileAssetIds** for the draft. DOCUMENT ids are not allowed (`MIG/030:534`). Any violation returns 400 `MARKETPLACE_LISTING_MEDIA_ORDER_INVALID`.

The new `displayOrder` values are 1..N in the order given. Documents cannot be reordered.

Success: 200 `{"rowVersion"}`.

### M4. `DELETE /media/{fileAssetId}` (L71-91)
Body: `{"expectedRowVersion"}`. A body is required (§1.5).

A missing association returns 404 `MARKETPLACE_LISTING_MEDIA_NOT_FOUND`.

After the delete, IMAGE `displayOrder` values are renumbered 1..N. If the deleted image was primary, the image with the lowest order becomes primary. The file itself is **not** deleted from the files service.

Success: 200 `{"rowVersion"}`.

### M5. `PUT /media/{fileAssetId}/primary` (L93-113)
Body: `{"expectedRowVersion"}`.

| Condition | Failure |
|---|---|
| The association exists | 404 `MARKETPLACE_LISTING_MEDIA_NOT_FOUND` |
| The media is not a DOCUMENT | 400 `MARKETPLACE_LISTING_PRIMARY_IMAGE_INVALID` |

Success: 200 `{"rowVersion"}`.

---

## 6. Inventory (`API/Controllers/MarketplaceListingInventoryController.cs`, route `.../listings/{listingId:guid}/inventory`, L14)

Inventory semantics (`MIG/031`, `MIG/032`):
- There is **one row per listing**, so inventory is not versioned.
- `onHandQuantity >= 0` and `reservedQuantity >= 0`, with `reservedQuantity <= onHandQuantity`.
- `sellableQuantity = onHand - reserved`.
- Values are DECIMAL(18,4). Extra decimals are rounded by SQL, and overflow returns 500.
- Fractional quantities are allowed for **any** unit. The unit's `quantityDecimalPrecision` is not enforced.
- Only buyers' checkout flows change `reserved`, through internal reservation endpoints.
- Inventory can be edited in **any listing status except `ARCHIVED`**, which returns 409 `MARKETPLACE_LISTING_TRANSITION_INVALID` (`MIG/032:111,240,394`). This includes `DRAFT`.
- Publish and resume require `sellable > 0`.

Response `ListingInventoryResponse` (`CT/Inventory/ListingInventoryDtos.cs:6-14`):
```json
{"listingId","onHandQuantity","reservedQuantity","sellableQuantity","quantityUnitId":null|guid,"rowVersion":null|"b64"}
```
- `quantityUnitId` comes from the draft version, or from the published version if there is no draft.
- `rowVersion: null` means **no inventory row exists yet**.

Errors (`INF/Repositories/Listings/ListingInventoryRepository.cs:25-150`):
- 404 `MARKETPLACE_LISTING_NOT_FOUND`, 404 `MARKETPLACE_INVENTORY_NOT_FOUND`
- 403 `MARKETPLACE_SELLER_ACCESS_DENIED`
- 409 `MARKETPLACE_INVENTORY_VERSION_CONFLICT`, 409 `MARKETPLACE_INVENTORY_QUANTITY_BELOW_RESERVED`
- 400 `MARKETPLACE_INVENTORY_QUANTITY_INVALID`, 400 `MARKETPLACE_INVENTORY_ADJUSTMENT_INVALID`, 400 `MARKETPLACE_INVENTORY_ROW_VERSION_INVALID`

### I1. `GET /inventory` (L43-52)
Returns a zero state (all quantities 0 and `rowVersion: null`) when no row exists.

### I2. `PUT /inventory`: set on-hand (L54-79)
Body: `SetListingInventoryRequest` `{"expectedRowVersion":null|"b64","onHandQuantity":number,"reasonCode":null|str,"notes":null|str}` (`CT/Inventory/ListingInventoryDtos.cs:16-22`).

Behaviour (`APP/Inventory/ListingInventoryService.cs:102-162`):
- `onHandQuantity < 0` returns 400 `MARKETPLACE_INVENTORY_QUANTITY_INVALID`.
- **Initial set** (`expectedRowVersion` null or blank):
  - Allowed only if no row exists. Otherwise the response is 400 `MARKETPLACE_INVENTORY_ROW_VERSION_INVALID`. If another request creates the row first, the response is 409 `MARKETPLACE_INVENTORY_VERSION_CONFLICT`.
  - Writes movement `INITIAL` with reason `INITIAL`. **`reasonCode` and `notes` are ignored.**
- **Subsequent set** (`expectedRowVersion` present):
  - The value must be base64 of 8 bytes.
  - Setting `onHandQuantity` below `reserved` returns 409 `MARKETPLACE_INVENTORY_QUANTITY_BELOW_RESERVED`.
  - Writes movement `MANUAL_SET`.
- `reasonCode` is truncated to 50 characters and `notes` to 500 (NVARCHAR(500)). Both are optional.

Success: 200 `ListingInventoryResponse` with the new inventory `rowVersion`.

### I3. `POST /inventory/adjustments` (L81-106)
Body: `AdjustListingInventoryRequest` `{"expectedRowVersion":"b64","quantityDelta":number,"reasonCode":null|str,"notes":null|str}`.

`expectedRowVersion` is required (§1.5).

| Rule | Failure |
|---|---|
| `quantityDelta` is not 0 | 400 `MARKETPLACE_INVENTORY_ADJUSTMENT_INVALID` |
| An inventory row exists | 404 `MARKETPLACE_INVENTORY_NOT_FOUND`. Use I2 first |
| The new on-hand quantity is not below 0 | 400 `MARKETPLACE_INVENTORY_QUANTITY_INVALID` |
| The new on-hand quantity is not below the reserved quantity | 409 `MARKETPLACE_INVENTORY_QUANTITY_BELOW_RESERVED` |

The movement type is `MANUAL_INCREASE` for a positive delta and `MANUAL_DECREASE` for a negative one (`MIG/032:423-433`).

Success: 200 `ListingInventoryResponse`.

### I4. `GET /inventory/movements?page=1&pageSize=20` (L108-126)
`page < 1` becomes 1, `pageSize < 1` becomes 20, and `pageSize > 100` becomes 100. The response echoes the **clamped** values (`ListingInventoryService.cs:201-247`).

Order: `createdAtUtc` DESC, then `movementId` DESC.

Response: `ListingInventoryMovementsResponse` `{"listingId","page","pageSize","totalCount","items":[...]}`. Each item has these fields:
- `movementId`, `movementType`
- `onHandQuantityDelta`, `reservedQuantityDelta`
- `onHandQuantityBefore`, `onHandQuantityAfter`, `reservedQuantityBefore`, `reservedQuantityAfter`
- `referenceType?`, `referenceId?`
- `reasonCode?`, `notes?`
- `createdByUserId?`, `createdAtUtc`

---

## 7. Inspections, seller view (`API/Controllers/MarketplaceListingInspectionsController.cs`, route `.../listings/{listingId:guid}/inspections`, L14)

Moderation creates inspections automatically when the category requires one. Sellers can only read them and request re-inspection.

### S1. `GET /inspections?page=1&pageSize=20` (L39-50)
The SQL clamps `page` (min 1) and `pageSize` (min 1, default 20, max 100). The response **echoes the raw, unclamped values** (`ListingInspectionService.cs:566-596`, `MIG/034:219-275`).

A listing owned by another seller returns 403 `MARKETPLACE_INSPECTION_ACCESS_DENIED`.

Response: `PagedInspectionQueueResponse` `{"items": InspectionSummaryDto[], "totalCount","page","pageSize"}`, ordered by `createdAtUtc` DESC. `InspectionSummaryDto` is defined in `CT/Inspections/InspectionDtos.cs:6-32` and its fields are listed in the TS file.

### S2. `GET /inspections/latest` (L52-66)
Returns 200 `InspectionDetailDto`: the summary plus `responses[]`, `evidence[]` (each with a `downloadUrl` or null), `statusHistory: []` and `assignmentHistory: []`. Both history arrays are **always empty** for sellers (`ListingInspectionService.cs:222`).

If no inspection exists, the response is **404 with an empty body** (`NotFound()`), which the gateway may rewrite (§1.1).

### S3. `POST /inspections/{inspectionId}/request-reinspection` (L68-79)
Body: `{"remediationNotes":"string"}`. The value must not be blank. The service returns 400 `MARKETPLACE_INSPECTION_REQUEST_INVALID`, but in practice the model check returns `INVALID_DATA` first.

The inspection must be `COMPLETED` with result `FAIL` or `REINSPECTION_REQUIRED`. Otherwise the response is 409 `MARKETPLACE_INSPECTION_REINSPECTION_INVALID` (`MIG/034:1854-1935`).

Other errors:
- 404 `MARKETPLACE_INSPECTION_NOT_FOUND`
- 403 `MARKETPLACE_INSPECTION_ACCESS_DENIED`: the inspection is on a different listing or seller

Success: **202 with an empty body.** This only records a history row and an outbox event (`inspection.reinspection-requested.v1`). An admin must authorize the re-inspection. There is no deduplication.

---

## 8. Lifecycle from the seller's perspective

```
create (L1) -> listing DRAFT / version v1 DRAFT
  edit: L4 update, A2 attributes, M* media, I* inventory      (listing status must be DRAFT for L4/A2)
  L5 submit -> version UNDER_REVIEW                           (listing stays DRAFT)
  admin decide (MIG/036:796-1159):
     REQUEST_CHANGES -> version CHANGES_REQUIRED  -> seller edits and resubmits (L5)
     REJECT          -> version REJECTED          -> dead end: cannot resubmit (L5 needs DRAFT|CHANGES_REQUIRED); only archive
     APPROVE         -> version APPROVED, or INSPECTION_REQUIRED (inspection auto-created)
  admin publish (POST /api/v1/admin/catalog/listings/{id}/versions/{vid}/publish, MIG/036:1252-1468):
     needs version APPROVED, basePrice>0, sellable>0, primary IMAGE, inspection PASS if required
     -> listing PUBLISHED, version PUBLISHED, previous published -> SUPERSEDED, currentDraftVersionId := NULL (L1380)
PUBLISHED --L8 pause--> SUSPENDED(SELLER_REQUESTED_PAUSE) --L9 resume--> PUBLISHED
PUBLISHED --admin suspend--> SUSPENDED(admin reason)  (seller resume -> 403 MARKETPLACE_SELLER_RESUME_BLOCKED)
PUBLISHED --expiresAtUtc passes--> EXPIRED (ListingExpiryWorker, polls every 60 s; reads treat past-expiry as EXPIRED immediately)
DRAFT | SUSPENDED | EXPIRED | ARCHIVED --L10 archive--> ARCHIVED (terminal); PUBLISHED cannot be archived directly
```

Which actions work in each state:

| Listing status (draft present?) | L4 update | A2 attrs | M* media | I* inventory | L5 submit | L8 pause | L9 resume | L10 archive |
|---|---|---|---|---|---|---|---|---|
| DRAFT (yes) | yes. **No version-status guard** (D4) | yes (D4) | yes | yes | if version is DRAFT or CHANGES_REQUIRED | no | no | yes |
| PUBLISHED (no draft; the normal case) | **409** | **404** | **409** | yes | 409 | yes | no | **409**; pause first |
| SUSPENDED | 409 | 404 | 409 | yes | 409 | no | yes, if paused by the seller | yes |
| EXPIRED | 409 | 404 | 409 | yes | 409 | no | no | yes |
| ARCHIVED | 409 | 409 or 404 | 409 | 409 | 409 | no | no | yes (no-op re-archive) |

**Editing a PUBLISHED listing is impossible through the seller API (D2).** `PR_LISTING_CREATE_VERSION` would clone the published version into a new draft. It exists in SQL and in `IListingRepository.CreateVersionAsync` (`INF/Repositories/Listings/ListingRepository.cs:186-213`), but **no service or controller calls it**. Even if a draft did exist, L4 and A2 would still return 409, because they require listing status `DRAFT` (`MIG/032:1317`, `MIG/027:51`). Media mutations do allow `PUBLISHED`-with-draft.

---

## 9. Public read endpoints (anonymous, `/api/v1/catalog/...`)

### P1. `GET /api/v1/catalog/listings/{listingId:guid}` (`API/Controllers/PublicListingsController.cs:26-63`, `APP/Publication/ListingPublicationService.cs:799-994`, `MIG/038`)

This endpoint returns the **bare DTO**, with no envelope.

**200 `PublicListingDetailResponse`** (`CT/Publication/PublicationDtos.cs:274-322`). Notes on specific fields:
- `listingVersionId` and `publishedVersionId` hold the same value.
- `listingNumber` is `"LST-" + first 8 hex characters of listingId, uppercased`.
- `unitOfMeasure` is the unit symbol, falling back to its name.
- `sellableQuantity` and `sellableOnHandQuantity` are equal and never below 0.
- `isAvailable` means `sellable > 0`.
- `categoryBreadcrumb` and `categoryPathIds` run **root to leaf** and are strings.
- `galleryImages` contains IMAGEs only, primary first and then by `displayOrder`. Each has `cdnUrl = "/api/v1/files/{fileAssetId}/download"` (see D5).
- `primaryImage` and `primaryMediaUrl` describe the primary image.
- `attributes[]` holds `{code,name,textValue,numValue,numericValue}`, ordered by `code`. `textValue` is the text, the option value, `"true"`/`"false"`, `yyyy-MM-dd`, or a number as a string.
- `seller` holds `{sellerId, displayName (fallback "Marketplace Seller"), entityType (fallback "BUSINESS"), isVerified}`.
- `location` is always an object; missing parts are `""`.
- `publishedAtUtc` falls back to the current time.

Other outcomes:

| Status | Condition | Body |
|---|---|---|
| **410** | The listing is SUSPENDED or EXPIRED, is PUBLISHED but past `expiresAtUtc`, or the seller is not valid, canOperate, ACTIVE, VERIFIED and onboarding COMPLETED | `PublicListingUnavailableResponse` `{"listingId","error":"MARKETPLACE_LISTING_UNAVAILABLE","message":"This listing is currently suspended or expired and cannot be purchased.","alertBanner":"<same text>","isAvailable":false}` |
| 404 | The listing is DRAFT, ARCHIVED or unknown | `{"error":"MARKETPLACE_LISTING_NOT_FOUND","message":"Listing not found or no longer available."}` |
| 503 | The seller service is down (fail-closed) | `{"error":"SERVICE_UNAVAILABLE",...}` |
| 404 (empty body) | The id is not a GUID (route constraint) | – |

### P2–P9. Taxonomy reads
These were checked against the source and match `docs/contracts/catalog-taxonomy.md`. They use the `{success:true,data}` envelope and are anonymous. They have **no exception filter**, so SQL errors return an empty 500.

| # | Path | Data | Notes |
|---|---|---|---|
| P2 | `GET /catalog/categories` (`PublicCategoriesController.cs`) | `PublicCategoryTreeResponse[]` `{categoryId,slug,parentCategoryId,name,children[]}` | active roots with nested children |
| P3 | `GET /catalog/categories/{categoryId:guid}/listing-requirements` | `ListingRequirementsResponse` `{categoryId, attributes, brands, unitRules, conditionRules}` | 404 `CATEGORY_NOT_FOUND`; 409 `CATEGORY_INACTIVE` or `CATEGORY_HIERARCHY_INVALID` |
| P4 | `GET /catalog/categories/{categoryId:guid}/units` | `PublicCategoryUnitsResponse` | unknown or inactive category: 200 with empty units |
| P5 | `GET /catalog/categories/{categoryId}/attributes` | `EffectiveCategoryAttributeResponse[]` | same errors as P3. Options listed are active only |
| P6 | `GET /catalog/categories/{categoryId}/brands` | `EffectiveCategoryBrandResponse[]` | unknown category: 200 `[]` |
| P7 | `GET /catalog/categories/{categoryId}/conditions` | `PublicCategoryConditionsResponse` | unknown category: 200 with empty conditions |
| P8 | `GET /catalog/brands` | `PublicBrandResponse[]` | active brands, ordered by name |
| P9 | `GET /catalog/brands/{brandId}` | `PublicBrandResponse` | missing or inactive brand: 404 `BRAND_NOT_FOUND` |

There is **no** public `GET /catalog/units`, `/catalog/attributes` or `/catalog/conditions`.

---

## 10. Known defects and ambiguities

1. **D1. Moderation status is always "DRAFT".** `PR_LISTING_GET_BY_ID` never selects `LISTING_VERSION.Status` (`MIG/025:175`). As a result, `ListingVersion.Status` keeps its default `"DRAFT"` (`Domain/Listings/ListingVersion.cs`), and L6 always reports `status: "DRAFT"` while a draft exists, even when it is `UNDER_REVIEW`, `APPROVED` or `REJECTED`. Combine it with `decision` and `reviewedAtUtc`. The seller API has **no reliable way to read the version status**.
2. **D2. Published listings cannot be edited.** `CreateVersionAsync` is never called, and publishing clears `currentDraftVersionId`. Price, title, attribute and media changes after publish are impossible for sellers.
3. **D3. The primary-media owner check uses the wrong id.** Publish and resume validate the primary image with `ownerUserId = sellerId` (`ListingPublicationService.cs:134,566`). Attach validates with the uploader's `userId`, and inventory-media requires `OwnerUserId == ownerUserId`. Unless the seller id equals the user id, resume (and admin publish) fail with 409 `MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION`. **This needs runtime verification.**
4. **D4. Draft guards check the wrong status.** Update, attributes and media check the **listing** status (`DRAFT`), not the version status. A draft can therefore be edited while `UNDER_REVIEW`, or after `APPROVED`, and the admin then publishes unreviewed content. Separately, the `CHANGES_REQUIRED` branch in those SQL guards can never match, because it compares a version status against the listing status.
5. **D5. Public image URLs point to a route that does not exist.** The public `cdnUrl` `/api/v1/files/{id}/download` has no handler. inventory-media exposes only `POST /api/v1/files/{fileId}/download-url`, and that requires the owner. Buyers cannot load gallery images.
6. **D6. Submit idempotency is a no-op.** The submit `X-Idempotency-Key` is required but ignored. Create replay returns the **current** state, not the original response. If the draft pointer has since been cleared (after publish), the replay subquery `VersionNumber` is NULL and the Dapper mapping throws, giving **500 `INTERNAL_SERVER_ERROR`**.
7. **D7. Rejected listings are a dead end.** A REJECTED version cannot be resubmitted or replaced, so the only remaining action is archive.
8. **D8. Weak readiness checks.**
   - Submit readiness accepts a DOCUMENT as the only media, and it does not check required attributes or inventory. L7 validate is advisory.
   - Create and update check only that the category, brand, condition, grade and unit **exist**. They do not check applicability or that the category is active.
   - `pricingMode` errors reuse `MARKETPLACE_LISTING_PRICE_INVALID`.
   - Validate never checks quantity.
9. **D9. Archive has no idempotency guard.** Re-archiving an ARCHIVED listing succeeds and writes another history row and outbox event.
10. **D10. Inconsistent error codes and paging.**
    - The same failure produces different codes on different endpoints. The full mapping is in §1.2: seller access, ownership (403 vs 409), dependency-down, and row-version errors all vary.
    - The listing list has no `pageSize` upper bound.
    - Inspection paging echoes unclamped values.
    - Listing create returns 200, not 201.
11. **D11. Some service checks can never fire.** The implicit `[Required]` (§1.5) makes `MARKETPLACE_LISTING_LOCATION_INVALID`, `MARKETPLACE_*_ROW_VERSION_INVALID` (for non-nullable fields) and `MARKETPLACE_INSPECTION_REQUEST_INVALID` effectively unreachable; `INVALID_DATA` "Validation failed" fires first. I inferred this from framework behaviour, not from explicit code.
12. **D12. Strings are silently truncated.** SQL procedure parameters truncate over-length strings without an error: location fields, `documentType` (100), inventory `reasonCode` (50) and `notes` (500), and `search` (255). Enforce these limits on the client.
13. **D13. Multi-select attributes are blank on public detail.** For MULTI_SELECT attributes, public detail `attributes[].textValue` and `numValue` are null, because P1 does not join `LISTING_ATTRIBUTE_OPTION_VALUE` (`MIG/038:226-245`).
14. **D14. Members are locked out unless the seller is fully active.** Sellers whose org `status` is not `ACTIVE`, and non-owner members, get 403 on **every** endpoint, including read-only ones (moderation-status excepted for members). An onboarding seller cannot even prepare drafts.
