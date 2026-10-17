# Buyer search, suggestions, saved searches, listing images — API contract

Verified against the current source of `/home/user/stockout` on 2026-10-17, including migrations `007_Stage6E_SavedSearchesAndAlerts.sql` and `008_Stage6F_SearchAdministrationReindexAnalytics.sql`. Supersedes `stockout_admin/docs/contracts/files-notifications-search.md` §C, which is now **out of date**: it says the service has no authentication, which is no longer true.
TS types: `src/api/types/search.ts`.

Abbreviations, relative to `services/search-discovery/src/`:
- `Ctl/` = `Emcore.SearchDiscovery.Api/Controllers/`
- `Auth` = `Emcore.SearchDiscovery.Api/Authentication/SearchBuyerAuthenticationHandler.cs`
- `SC` = `Emcore.SearchDiscovery.Contracts/Search/SearchListingsContracts.cs`
- `SSC` = `.../Contracts/Search/SearchSuggestionsContracts.cs`
- `SVC` = `.../Contracts/Search/SavedSearchContracts.cs`
- `SV` = `Emcore.SearchDiscovery.Application/Search/SearchListingsRequestValidator.cs`
- `SSer` = `Emcore.SearchDiscovery.Application/SavedSearches/SavedSearchCriteriaSerializer.cs`
- `SSvc` = `.../Application/SavedSearches/SavedSearchService.cs`
- `M7` = `../Emcore.SearchDiscovery.Migrator/Migrations/Versioned/007_Stage6E_SavedSearchesAndAlerts.sql`

## 0. Conventions

- **Gateway:** the route `search-discovery-route` matches `/api/v1/search/{**catch-all}` with `PublicPolicy` and `AnonymousPolicy`, a fixed window of 60 requests per minute per IP (`gateways/Emcore.ApiGateway/appsettings.json`). The path is forwarded unchanged. The gateway does **not** strip the `Authorization` header, so a Bearer token reaches the service. That is how saved searches authenticate even though the route itself is public.
- **JSON:** System.Text.Json web defaults. Property names are camelCase and nulls are written. Dictionary keys are emitted verbatim, so attribute CODEs stay uppercase. There is no `JsonStringEnumConverter`, and every enum-like field is a `string`.
- **No envelope:** success bodies are the DTO itself.
- **Errors:** all errors use `SearchProblemDetailsDto` (`SC:184-193`). The exceptions are an empty-body 404 for an unmatched route and the 401 described under §3.
  ```json
  { "type": "https://tools.ietf.org/html/rfc7807", "title": "MARKETPLACE_SEARCH_FILTER_INVALID", "status": 400,
    "detail": "<human message>", "errorCode": 50901, "errorSymbol": "MARKETPLACE_SEARCH_FILTER_INVALID", "traceId": "..." }
  ```
  - Producers: `Emcore.SearchDiscovery.Api/Filters/SearchExceptionFilterAttribute.cs:10-68` and the custom `InvalidModelStateResponseFactory` (`Emcore.SearchDiscovery.Api/Program.cs:21-50`).
  - Model-binding errors (`page=abc`, a bad GUID in `brandId`, malformed JSON) give 50902 when the key is `page` or `pageSize`, and 50901 otherwise.
  - 503 responses add `Retry-After: 30`.
  - Any non-domain exception gives 500 with code 50900.

| errorCode | errorSymbol | HTTP | Reachable from |
|---|---|---|---|
| 50900 | MARKETPLACE_SEARCH_INTERNAL_ERROR | 500 | all |
| 50901 | MARKETPLACE_SEARCH_FILTER_INVALID | 400 | listings, suggest, saved POST |
| 50902 | MARKETPLACE_SEARCH_PAGINATION_INVALID | 400 | listings |
| 50903 | MARKETPLACE_SEARCH_PAGINATION_LIMIT_EXCEEDED | 400 | listings |
| 50904 | MARKETPLACE_SEARCH_CURRENCY_REQUIRED | 400 | listings, saved POST |
| 50905 | MARKETPLACE_SEARCH_SORT_INVALID | 400 | listings, saved POST |
| 50906 | MARKETPLACE_SEARCH_UNAVAILABLE | 503 | listings, suggest |
| 50907 | MARKETPLACE_SAVED_SEARCH_NOT_FOUND | 404 | saved DELETE |
| 50908 | MARKETPLACE_SAVED_SEARCH_LIMIT_EXCEEDED | 409 | saved POST |

Codes 50909 to 50915 are admin-only or internal. Source: `Emcore.SearchDiscovery.Domain/Exceptions/SearchErrorCodes.cs`, `SearchDiscoveryException.cs`.

## 1. GET /api/v1/search/listings — anonymous

Source: `Ctl/SearchListingsController.cs:26-40` (`[AllowAnonymous]`). Validation is in `SV:20-160`.

An invalid or expired Bearer token on this endpoint is ignored. Authentication fails, but `[AllowAnonymous]` lets the request through.

Query parameters (`SearchListingsRequest`, `SC:6-25`). Names are case-insensitive.

| Param | Type | Default | Rules |
|---|---|---|---|
| `q` | string | — | Control characters become spaces and whitespace is collapsed. Max 200 characters (`SV:96-100`). |
| `categoryId` | GUID | — | Must not be the empty GUID. Matches the category **or any descendant** (`categoryPathIds`, `Infrastructure/OpenSearch/OpenSearchListingsQueryRepository.cs:360-369`). |
| `brandId`, `conditionId`, `gradeId` | GUID list | — | Repeat the key and/or comma-separate values (`Api/ModelBinding/CommaSeparatedGuidListModelBinder.cs`). At most 50 values per key, no empty GUID (`SV:177-197`). Values are ORed within a group and groups are ANDed. |
| `currency` | string | — | Exactly 3 ASCII letters, upper-cased. **Required** when `minPrice` or `maxPrice` is set, or when `sort=price_*` (50904, `SV:58-78`). When given, it is also an exact-match filter on the listing currency. |
| `minPrice`, `maxPrice` | decimal | — | Each must be at least 0, and `minPrice` must not exceed `maxPrice`. Compared against `basePrice`. |
| `countryCode` | string | — | Exactly 2 ASCII letters, upper-cased (`SV:113-123`). |
| `stateOrEmirate` | string | — | Max 100 characters. Case-insensitive exact match. |
| `city` | string | — | Max 100 characters. Case-insensitive exact match or phrase/contains match. |
| `inStockOnly` | bool | `false` | When true, requires `isAvailable=true` and `sellableQuantity>0`. |
| dynamic attributes | see below | — | — |
| `sort` | string | `relevance` | One of `relevance`, `date_desc`, `price_asc`, `price_desc`, case-insensitive (`SV:44-56`). |
| `page` | int | 1 | Must be at least 1. |
| `pageSize` | int | 20 | 1 to 100. `page*pageSize` must not exceed 1000 (50903, `SV:27-42`). |

There is **no `cursor`, `location`/geo, `brand` (by name) or `condition` (by name) parameter.** Use the GUID filters and page/pageSize.

**Dynamic attribute encoding.** There are four accepted forms, and all of them are merged:
1. `attributes[CODE]=v1,v2` (`Ctl/SearchListingsController.cs:58-66`)
2. `attrs[CODE]=v1,v2` (same lines)
3. `attrs.CODE=v1` or `attributes.CODE=v1` (`:67-74`). Repeated keys are joined with `,`.
4. `attr=CODE:v1,v2`, which may be repeated (`SV:213-233`).

Rules (`SV:241-284`):
- CODE is trimmed and upper-cased, then must match `^[A-Z0-9_-]{1,64}$`.
- Values are split on `,`, trimmed, must be non-empty, and are at most 128 characters each.
- Within a CODE, values are ORed. Different CODEs are ANDed.

Matching is an **exact, case-sensitive** term on `attributes.textValue.keyword`. If a value parses as a number, it also matches `attributes.numValue` (`OpenSearchListingsQueryRepository.cs:450-487`). The filter CODE is upper-cased but the indexed code is compared verbatim, so attribute codes must be uppercase in the catalog. This is an ambiguity: no normalization of indexed codes was found. There is no range filtering on attributes.

Response 200 `SearchListingsResponse` (`SC:35-46`), built in `Application/Search/SearchListingsService.cs:252-276`:
```
{ items: ListingSearchCardDto[], page, pageSize, totalCount, totalPages, sort,
  pagination: { page, pageSize, totalCount, totalPages, hasPreviousPage, hasNextPage },
  facets: { categories[{categoryId,categoryName,count}], brands|conditions|grades[{id,name,count}],
            countries|statesOrEmirates|cities|currencies[{key,count}],
            priceRange{currency|null,minPrice|null,maxPrice|null}, inStockCount,
            attributes[{code, values[{key,count}]}] },
  appliedFilters: { q|null, categoryId|null, brandIds[], conditionIds[], gradeIds[], currency|null, minPrice|null, maxPrice|null,
                    countryCode|null, stateOrEmirate|null, city|null, inStockOnly, attributes{CODE: string[]} } }
```
- **Pagination** (`SearchListingsService.cs:252-273`):
  - `totalPages = ceil(totalCount/pageSize)`.
  - `hasNextPage = page < totalPages && page*pageSize < 1000`.
  - Pinned results (admin feature) can be inserted on page 1 and are counted in `totalCount`.
- **Card fields** (`ListingSearchCardDto`, `SC:58-89`, mapped in `SearchListingsService.cs:359-416`):
  - Identity and text: `listingId, publishedVersionId, versionNumber, listingNumber, title, description|null`.
  - Category: `categoryId, categoryName, categoryBreadcrumb: string[]`.
  - Classification: `brandId|null, brandName|null, conditionId|null, conditionName|null, gradeId|null, gradeName|null`.
  - Pricing: `pricingMode` (string, default `"FIXED_PRICE"`), `basePrice`, `currency`.
  - Quantity: `quantityUnitId|null, quantityUnitName|null, quantityUnitSymbol|null, sellableQuantity, isAvailable, expiresAtUtc|null`.
  - Media: `primaryImage: {fileAssetId, cdnUrl}|null`.
  - Seller: `seller: {sellerId, displayName, entityType, isVerified}`.
  - Location: `location: {countryCode, stateOrEmirate, city}`. These are `""` when unknown.
  - Other: `attributes: [{code, textValue|null, numValue|null}]`, `publishedAtUtc`.
- **Visibility** (`SearchListingsService.cs:311-319`, `OpenSearchListingsQueryRepository.cs:343-357`): a listing appears only if it has a `publishedVersionId`, its seller is verified, it is not expired, and it is in stock when `inStockOnly` is set.
- **Facets** are disjunctive: each group is computed without its own filter (`OpenSearchListingsQueryRepository.cs:624-703`, extracted at `:705+`). Bucket limits:
  - 50 each for categories, brands, conditions, grades, countries, states and cities.
  - 20 for currencies.
  - 30 attribute codes, with up to 25 text values each.
  - `priceRange` comes from stats over `basePrice` with the other filters applied. Its `currency` echoes the request currency.
- Responses are cached in memory for **60 s** per normalized query (`Application/Search/ISearchQueryCache.cs:19`).

## 2. GET /api/v1/search/suggest — anonymous

Source: `Ctl/SearchSuggestionsController.cs:25-37`. Validation is in `Application/Search/SearchSuggestionsRequestValidator.cs:9-73`.

Query:
- `prefix` is required. It is sanitized like `q` and must be 1 to 100 characters after sanitizing.
- `limit` is an int, default 10, range 1 to 25.
- Any violation gives 400 with code 50901.

Response 200 `SearchSuggestionsDto` (`SSC:19-34`):
```
{ prefix (sanitized), limit, totalCount (= suggestions.length),
  suggestions: [{ text, type: "listing"|"brand"|"category", listingId|null, brandId|null, categoryId|null }] }
```
Suggestions are deduplicated per `type:text` (`Application/Search/SearchSuggestionsService.cs:186-230`).

## 3. Saved searches — `[Route("api/v1/search/saved")]` — Bearer JWT required

Source: `Ctl/BuyerSavedSearchesController.cs:14-82`. The class has `[Authorize(Policy = "BuyerPolicy")]` (`:16`).

**How the user is identified** (`Auth:327-393`, `Auth:822-904`):
- The service validates the `Authorization: Bearer <accessToken>` JWT itself:
  - The algorithm must be RS256, verified against the identity JWKS.
  - `iss` must equal `Jwt:Issuer` (default `https://api.stockout.com/identity`).
  - `aud` must equal `Jwt:Audience` (default `https://api.stockout.com`).
  - `exp` is required and `nbf` is honored with 60 s skew.
- The buyer id is the `sub` claim (GUID, `N` or `D` format both parse).
- With no `Authorization` header, it falls back to the gateway's `X-User-Id`, but only if `X-Service-Auth` matches its own `ServiceAuth:Key`.
- `BuyerPolicy` (`Auth:840-888`) rejects:
  - `amr` containing `s2s` (service tokens),
  - `buyer_enabled=false`,
  - tokens that carry role claims without `BUYER`.

  Identity tokens carry no roles, so every normal user passes. `email_verified` is **not** checked, so PendingVerification users can use saved searches.
- The session is **not** checked: a token for a revoked session still works until `exp`, which is at most 15 min.

Auth failures:
- No token, or a bad, expired or wrong-issuer token: **401** `SearchProblemDetailsDto` with `title: "UNAUTHORIZED"`, `errorCode: 401`, `errorSymbol: "UNAUTHORIZED"`, `detail: "Authentication token is missing, expired, or invalid."` (`Auth:395-409`).
- Policy failure: **403** with `title/errorSymbol: "FORBIDDEN"` and `errorCode: 403` (`Auth:411-428`).

| Method & path | Line | Body | Success | Errors |
|---|---|---|---|---|
| `GET /api/v1/search/saved` | `:27-40` | — | 200 `BuyerSavedSearchesListResponse` `{ items: SavedSearchDto[], totalCount, maxAllowed: 50, remainingQuota }` (`SVC:32-38`). Active searches only, newest first (`M7:284-325`). No paging. | 401, 403 |
| `POST /api/v1/search/saved` | `:42-63` | `CreateSavedSearchRequest` (JSON) | **201** `SavedSearchDto` (no Location header) | 400 (50901, 50904, 50905), 401, 403, **409 50908** when the buyer already has 50 active searches (`SSvc:122-130`, `M7:170-184`) |
| `DELETE /api/v1/search/saved/{savedSearchId:guid}` | `:65-82` | — | **204** | 401, 403, **404 50907** if the search is unknown, already deleted or owned by another buyer (`SSvc:167-196`). A non-GUID id gives a 404 with an empty body (route constraint). |

There are **no alert endpoints**. You cannot get a saved search by id, update it, rename it, or toggle its alert. To change one, delete it and create a new one. Alerts are configured only through `alertFrequency` at creation.

How alerts work: a worker evaluates them and emits `search.alert.matched.v1` (`Contracts/Events/SearchIntegrationEvents.cs:122`), which `services/notification-integration/src/Emcore.NotificationIntegration.Worker/SearchAlertMatchedConsumerWorker.cs` consumes. The buyer is notified out of band.

`CreateSavedSearchRequest` (`SVC:6-30`), validated in `SSer:225-325`:
- `searchName` (required): sanitized, at most 120 characters. Otherwise 50901.
- Query text: `queryText` or `q`. `queryText` wins when non-blank.
- Filters: `categoryId`, `brandId|brandIds`, `conditionId|conditionIds`, `gradeId|gradeIds` (GUID arrays; the singular key wins if both are sent), `currency`, `minPrice`, `maxPrice`, `countryCode`, `stateOrEmirate`, `city`, `inStockOnly`, `attributes` (`{CODE: "v1,v2"}`), `attr` (`["CODE:v1"]`), `sort`. These are validated exactly like §1 (`SSer:266-287`).
- At least one criterion is required: a query, or any filter, or `inStockOnly:true`. Otherwise 400 `"A saved search must include at least a queryText or one valid search filter."`
- `alertFrequency` is case-insensitive and is one of `INSTANT | HOURLY | DAILY | DAILY_DIGEST | WEEKLY | DISABLED | NONE` (`Domain/SavedSearches/SavedSearchModels.cs:6-34`). Any other value gives 50901. The error message lists only INSTANT, DAILY, WEEKLY and NONE, but all seven are accepted.
  - Omitted or `NONE`: no active alert.
- `alertEnabled` is accepted but **ignored**.

`SavedSearchDto` (`SVC:40-61`, alert `SVC:53-61`; mapped in `SSer:603-635`):
```
{ savedSearchId, buyerUserId, searchName, queryText|null, sort,
  filters: AppliedSearchFiltersDto (same shape as §1 appliedFilters, normalized),
  alert: { alertId, frequency, isEnabled, lastEvaluatedAtUtc|null, lastMatchedAtUtc|null, nextEvaluationDueAtUtc|null } | null,
  createdAtUtc, updatedAtUtc }
```
- `alert` is in practice always present. With no alert requested, the repository still inserts an alert row with `frequency:"DISABLED"`, `isEnabled:false` and `nextEvaluationDueAtUtc:null` (`Infrastructure/Persistence/SavedSearchRepository.cs:56-70`, `M7:162-165`).
- To re-run a saved search, map `filters` and `sort` back to §1 query params, using `brandIds` → `brandId` and so on.

## 4. Listing images — how a browser can display them

- Every image URL is the **relative path** `"/api/v1/files/{fileAssetId}/download"`. It is hard-coded in `services/catalog-listing/src/Emcore.CatalogListing.Application/Publication/ListingPublicationService.cs:718` (the search projection) and `:903,919` (public listing detail `GET /api/v1/catalog/listings/{id}`, gallery and primary image).
- **That endpoint does not exist.** `services/inventory-media/src/Emcore.InventoryMedia.Api/Controllers/FilesController.cs` (class `[Authorize]`, `:13-14`) exposes only these routes:
  - `POST upload-requests`
  - `POST {id}/complete`
  - `GET {id}` (metadata)
  - `POST {id}/download-url`
  - `DELETE {id}`

  A grep across services and gateways finds no `GET .../download` route.
- The gateway route `inventory-media-files-route` (`/api/v1/files/**`) also uses `AuthenticatedRoutePolicy`. An anonymous browser `<img src="/api/v1/files/{id}/download">` therefore gets a **401** from the gateway. An authenticated request reaches inventory-media and gets **404** (no route).
- `POST /api/v1/files/{id}/download-url` returns a presigned URL, but it is **owner-only**: `FileAssetService.GetDownloadUrlAsync` throws `FILE_ACCESS_DENIED` (403) when `file.OwnerUserId != caller` (`Application/Services/FileAssetService.cs:201-206`). A buyer cannot use it. The seller who uploaded the image can, and gets a URL valid for 900 s by default.
- Internal `POST /api/internal/files/{id}/download-url` (X-Service-Auth) is not exposed through the gateway. Catalog uses it only for inspection evidence.
- **Conclusion:** with the current backend, a buyer's browser **cannot display listing images**, whether anonymous or logged in. The UI should treat `primaryImage` as "image exists" (use `fileAssetId` as a key) and render a placeholder. Displaying images needs a backend change: an anonymous public-media endpoint or real CDN URLs. A seller viewing their own listing can fetch a presigned URL through `download-url`.

## 5. Known defects / caveats

1. Image `cdnUrl` points to a non-existent, authenticated-only route (§4). Buyers cannot see listing images.
2. `items` is post-filtered in memory (seller verified, expiry, location) after the engine has paged (`SearchListingsService.cs:222-226`). A page can therefore hold fewer than `pageSize` items while `totalCount` is higher. Do not infer the end of results from `items.length`. Use `pagination.hasNextPage`.
3. Saved-search `alert.lastMatchedAtUtc` is always `null`: `SEARCH_ALERT` has no such column (`M7:67-88`).
4. `alertEnabled` in the create body is ignored. There is no endpoint to toggle or update an alert.
5. The 50901 message for a bad `alertFrequency` lists only 4 values, but 7 are accepted.
6. Saved-search auth does not check session revocation. A logged-out token keeps working for up to 15 min.
7. The search service's `ServiceAuth:Key` (`Api/appsettings.json:25-27`) differs from the gateway's (`emcore-internal-dev-key`) in the checked-in config, so the `X-User-Id` fallback is not trusted. The website must send `Authorization: Bearer` (it is forwarded as-is).
8. The attribute filter code is upper-cased, but indexed codes are not normalized (see §1). Text value matching is case-sensitive.
9. DateTimes in saved-search DTOs come from SQL and have no `Z`. Parse them as UTC.
10. The admin repo doc (§C) is stale: it says "no authentication", and the 50907 and 50908 codes are now reachable.
