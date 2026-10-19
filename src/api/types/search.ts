/**
 * Search & Discovery API types (services/search-discovery, gateway route /api/v1/search/* = PublicPolicy).
 * Responses are NOT enveloped (no {success,data}). JSON = System.Text.Json web defaults:
 * camelCase properties, nulls written, dictionary keys emitted verbatim (attribute CODEs stay uppercase).
 * See docs/contracts/buyer-search.md.
 */

/** ISO-8601 date-time string. May or may not end in "Z" (Dapper-read values have Kind=Unspecified); always UTC. */
export type IsoDateTime = string;

/** GUID string "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx". */
export type Guid = string;

// ---------------------------------------------------------------------------
// Enums (string unions)
// ---------------------------------------------------------------------------

/** C# Contracts.Search.SearchSortOrders (input is case-insensitive; output is lowercase). */
export type SearchSort = 'relevance' | 'date_desc' | 'price_asc' | 'price_desc';

/** C# Contracts.Search.SearchSuggestionTypes. */
export type SearchSuggestionType = 'listing' | 'brand' | 'category';

/**
 * C# Domain.SavedSearches.SearchAlertFrequencies — values accepted on create (case-insensitive, upper-cased).
 * "NONE" (or omitting the field) means "no alert"; the server then stores frequency "DISABLED".
 */
export type SearchAlertFrequencyInput =
  | 'INSTANT'
  | 'HOURLY'
  | 'DAILY'
  | 'DAILY_DIGEST'
  | 'WEEKLY'
  | 'DISABLED'
  | 'NONE';

/** Frequencies that can appear in SavedSearchAlert.frequency (CK_SEARCH_ALERT_Frequency, 007 migration). */
export type SearchAlertFrequency = SearchAlertFrequencyInput;

/** C# Domain.Exceptions.SearchErrorCodes symbols reachable from buyer endpoints (50900-50908). */
export type SearchErrorSymbol =
  | 'MARKETPLACE_SEARCH_INTERNAL_ERROR'
  | 'MARKETPLACE_SEARCH_FILTER_INVALID'
  | 'MARKETPLACE_SEARCH_PAGINATION_INVALID'
  | 'MARKETPLACE_SEARCH_PAGINATION_LIMIT_EXCEEDED'
  | 'MARKETPLACE_SEARCH_CURRENCY_REQUIRED'
  | 'MARKETPLACE_SEARCH_SORT_INVALID'
  | 'MARKETPLACE_SEARCH_UNAVAILABLE'
  | 'MARKETPLACE_SAVED_SEARCH_NOT_FOUND'
  | 'MARKETPLACE_SAVED_SEARCH_LIMIT_EXCEEDED';

/** Numeric codes matching SearchErrorSymbol. */
export type SearchErrorNumericCode =
  | 50900
  | 50901
  | 50902
  | 50903
  | 50904
  | 50905
  | 50906
  | 50907
  | 50908;

export const SEARCH_ERROR_CODES = {
  MARKETPLACE_SEARCH_INTERNAL_ERROR: 50900,
  MARKETPLACE_SEARCH_FILTER_INVALID: 50901,
  MARKETPLACE_SEARCH_PAGINATION_INVALID: 50902,
  MARKETPLACE_SEARCH_PAGINATION_LIMIT_EXCEEDED: 50903,
  MARKETPLACE_SEARCH_CURRENCY_REQUIRED: 50904,
  MARKETPLACE_SEARCH_SORT_INVALID: 50905,
  MARKETPLACE_SEARCH_UNAVAILABLE: 50906,
  MARKETPLACE_SAVED_SEARCH_NOT_FOUND: 50907,
  MARKETPLACE_SAVED_SEARCH_LIMIT_EXCEEDED: 50908,
} as const satisfies Record<SearchErrorSymbol, SearchErrorNumericCode>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * C# Contracts.Search.SearchProblemDetailsDto (domain errors, model-binding errors, auth challenge/forbid).
 * Domain errors: title === errorSymbol. 503 carries `Retry-After: 30`.
 * Auth challenge (saved searches): {title:"UNAUTHORIZED", status:401, errorCode:401, errorSymbol:"UNAUTHORIZED"}.
 * Auth forbid: {title:"FORBIDDEN", status:403, errorCode:403, errorSymbol:"FORBIDDEN"}.
 */
export interface SearchProblemDetails {
  /** always "https://tools.ietf.org/html/rfc7807" */
  type: string;
  title: SearchErrorSymbol | 'UNAUTHORIZED' | 'FORBIDDEN';
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503;
  detail: string;
  errorCode: SearchErrorNumericCode | 401 | 403;
  errorSymbol: SearchErrorSymbol | 'UNAUTHORIZED' | 'FORBIDDEN';
  traceId: string | null;
}

// ---------------------------------------------------------------------------
// GET /api/v1/search/listings
// ---------------------------------------------------------------------------

/**
 * Query for GET /api/v1/search/listings (C# SearchListingsRequest + controller-parsed attribute keys).
 * Encode as URL query params (names case-insensitive):
 * - GUID lists (brandId/conditionId/gradeId): repeated `brandId=a&brandId=b` and/or comma-separated `brandId=a,b`.
 * - Dynamic attributes: `attributes[CODE]=v1,v2` | `attrs[CODE]=…` | `attrs.CODE=…` | `attributes.CODE=…`
 *   and/or repeated `attr=CODE:v1,v2`. All sources are merged (OR within a code, AND across codes).
 * There is NO cursor param; pagination is page/pageSize only.
 */
export interface SearchListingsQuery {
  /** <= 200 chars after control-char removal + whitespace collapse */
  q?: string;
  /** matches the category or any descendant (categoryPathIds) */
  categoryId?: Guid;
  /** listings of one seller (Stage R2, non-empty GUID) */
  sellerId?: Guid;
  /** <= 50 values, no empty GUID */
  brandId?: Guid[];
  /** <= 50 values */
  conditionId?: Guid[];
  /** <= 50 values */
  gradeId?: Guid[];
  /** 3 ASCII letters (upper-cased). REQUIRED when minPrice/maxPrice set or sort is price_* (50904) */
  currency?: string;
  /** >= 0 */
  minPrice?: number;
  /** >= 0, >= minPrice */
  maxPrice?: number;
  /** 2 ASCII letters (upper-cased), exact match */
  countryCode?: string;
  /** <= 100 chars, case-insensitive exact match */
  stateOrEmirate?: string;
  /** <= 100 chars, case-insensitive exact or "contains" match */
  city?: string;
  /** default false */
  inStockOnly?: boolean;
  /** CODE -> comma-separated values. CODE upper-cased, ^[A-Z0-9_-]{1,64}$; each value <= 128 chars */
  attributes?: Record<string, string>;
  /** "CODE:VALUE[,VALUE]" expressions */
  attr?: string[];
  /** default 'relevance' */
  sort?: SearchSort;
  /** default 1, >= 1 */
  page?: number;
  /** default 20, 1..100; page*pageSize <= 1000 (50903) */
  pageSize?: number;
}

/** C# SearchPaginationMetadataDto. hasNextPage is also false once page*pageSize >= 1000. */
export interface SearchPaginationMetadata {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * C# SearchCardImageDto. cdnUrl is a RELATIVE path "/api/v1/files/{fileAssetId}/download"
 * which does NOT exist on any service (see buyer-search.md §Images) — do not render it directly.
 */
export interface SearchCardImage {
  fileAssetId: Guid;
  cdnUrl: string;
}

/** C# SearchCardSellerDto. entityType is "INDIVIDUAL" | "BUSINESS" in practice (free string in C#). */
export interface SearchCardSeller {
  sellerId: Guid;
  displayName: string;
  entityType: string;
  /** always true in results (unverified sellers are filtered out) */
  isVerified: boolean;
}

/** C# SearchCardLocationDto ("" when unknown). */
export interface SearchCardLocation {
  countryCode: string;
  stateOrEmirate: string;
  city: string;
}

/** C# SearchCardAttributeDto. */
export interface SearchCardAttribute {
  code: string;
  textValue: string | null;
  numValue: number | null;
}

/** C# ListingSearchCardDto. pricingMode is a free string from catalog (default "FIXED_PRICE"). */
export interface ListingSearchCard {
  listingId: Guid;
  publishedVersionId: Guid;
  versionNumber: number;
  listingNumber: string;
  title: string;
  description: string | null;
  categoryId: Guid;
  categoryName: string;
  categoryBreadcrumb: string[];
  brandId: Guid | null;
  brandName: string | null;
  conditionId: Guid | null;
  conditionName: string | null;
  gradeId: Guid | null;
  gradeName: string | null;
  pricingMode: string;
  basePrice: number;
  currency: string;
  quantityUnitId: Guid | null;
  quantityUnitName: string | null;
  quantityUnitSymbol: string | null;
  sellableQuantity: number;
  isAvailable: boolean;
  expiresAtUtc: IsoDateTime | null;
  primaryImage: SearchCardImage | null;
  seller: SearchCardSeller;
  location: SearchCardLocation;
  attributes: SearchCardAttribute[];
  publishedAtUtc: IsoDateTime;
}

/** C# CategoryFacetBucketDto. */
export interface CategoryFacetBucket {
  categoryId: Guid;
  categoryName: string;
  count: number;
}

/** C# IdNameFacetBucketDto (brands, conditions, grades). */
export interface IdNameFacetBucket {
  id: Guid;
  name: string;
  count: number;
}

/** C# TermFacetBucketDto (countries, statesOrEmirates, cities, currencies, attribute values). */
export interface TermFacetBucket {
  key: string;
  count: number;
}

/** C# PriceRangeFacetDto. currency echoes the request currency (null when none sent). */
export interface PriceRangeFacet {
  currency: string | null;
  minPrice: number | null;
  maxPrice: number | null;
}

/** C# AttributeFacetGroupDto. values are textValue terms only (numeric-only attributes produce no buckets). */
export interface AttributeFacetGroup {
  code: string;
  values: TermFacetBucket[];
}

/** C# SearchFacetsDto. Disjunctive: each group ignores its own active filter. */
export interface SearchFacets {
  categories: CategoryFacetBucket[];
  brands: IdNameFacetBucket[];
  conditions: IdNameFacetBucket[];
  grades: IdNameFacetBucket[];
  countries: TermFacetBucket[];
  statesOrEmirates: TermFacetBucket[];
  cities: TermFacetBucket[];
  currencies: TermFacetBucket[];
  priceRange: PriceRangeFacet;
  inStockCount: number;
  attributes: AttributeFacetGroup[];
}

/** C# AppliedSearchFiltersDto (normalized echo of the request). attributes keys = uppercase CODEs. */
export interface AppliedSearchFilters {
  q: string | null;
  categoryId: Guid | null;
  brandIds: Guid[];
  conditionIds: Guid[];
  gradeIds: Guid[];
  currency: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  countryCode: string | null;
  stateOrEmirate: string | null;
  city: string | null;
  inStockOnly: boolean;
  attributes: Record<string, string[]>;
}

/**
 * C# SearchListingsResponse. NOTE: items are post-filtered in memory, so items.length may be < pageSize
 * even when more results exist. Cached in-memory for 60 s per normalized query.
 */
export interface SearchListingsResponse {
  items: ListingSearchCard[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  sort: SearchSort;
  pagination: SearchPaginationMetadata;
  facets: SearchFacets;
  appliedFilters: AppliedSearchFilters;
}

// ---------------------------------------------------------------------------
// GET /api/v1/search/suggest
// ---------------------------------------------------------------------------

/** Query for GET /api/v1/search/suggest (C# SearchSuggestionsRequest). */
export interface SearchSuggestQuery {
  /** required, 1..100 chars after sanitisation */
  prefix: string;
  /** default 10, 1..25 */
  limit?: number;
}

/** C# SearchSuggestionItemDto. Exactly one of listingId/brandId/categoryId is expected per type. */
export interface SearchSuggestionItem {
  text: string;
  type: SearchSuggestionType;
  listingId: Guid | null;
  brandId: Guid | null;
  categoryId: Guid | null;
}

/** C# SearchSuggestionsDto. totalCount === suggestions.length. */
export interface SearchSuggestionsResponse {
  prefix: string;
  limit: number;
  totalCount: number;
  suggestions: SearchSuggestionItem[];
}

// ---------------------------------------------------------------------------
// Saved searches: /api/v1/search/saved (Bearer JWT required; BuyerPolicy)
// ---------------------------------------------------------------------------

/**
 * C# Contracts.Search.CreateSavedSearchRequest — JSON body of POST /api/v1/search/saved.
 * Aliases: queryText wins over q; brandId wins over brandIds (same for condition/grade) when both sent.
 * At least one criterion (query or a filter) is required. Validated with the same rules as SearchListingsQuery.
 */
export interface CreateSavedSearchRequest {
  /** required; control chars removed, whitespace collapsed; <= 120 chars */
  searchName: string;
  queryText?: string | null;
  q?: string | null;
  categoryId?: Guid | null;
  brandId?: Guid[] | null;
  brandIds?: Guid[] | null;
  conditionId?: Guid[] | null;
  conditionIds?: Guid[] | null;
  gradeId?: Guid[] | null;
  gradeIds?: Guid[] | null;
  currency?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  countryCode?: string | null;
  stateOrEmirate?: string | null;
  city?: string | null;
  inStockOnly?: boolean | null;
  /** CODE -> comma-separated values */
  attributes?: Record<string, string> | null;
  /** "CODE:VALUE[,VALUE]" */
  attr?: string[] | null;
  sort?: SearchSort | null;
  /** omitted/null/"NONE" => no alert */
  alertFrequency?: SearchAlertFrequencyInput | null;
  /** accepted but IGNORED by the server */
  alertEnabled?: boolean | null;
}

/** C# SavedSearchAlertDto. lastMatchedAtUtc is always null (no DB column). */
export interface SavedSearchAlert {
  alertId: Guid;
  frequency: SearchAlertFrequency;
  isEnabled: boolean;
  lastEvaluatedAtUtc: IsoDateTime | null;
  lastMatchedAtUtc: IsoDateTime | null;
  nextEvaluationDueAtUtc: IsoDateTime | null;
}

/**
 * C# SavedSearchDto. `filters` is the normalized criteria (same shape as AppliedSearchFilters).
 * `alert` is in practice always present (frequency "DISABLED", isEnabled false when no alert was requested),
 * but typed nullable as in C#.
 */
export interface SavedSearch {
  savedSearchId: Guid;
  buyerUserId: Guid;
  searchName: string;
  queryText: string | null;
  sort: SearchSort;
  filters: AppliedSearchFilters;
  alert: SavedSearchAlert | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime;
}

/** C# BuyerSavedSearchesListResponse (GET /api/v1/search/saved). Ordered newest first. */
export interface BuyerSavedSearchesListResponse {
  items: SavedSearch[];
  totalCount: number;
  /** 50 */
  maxAllowed: number;
  /** max(0, maxAllowed - totalCount) */
  remainingQuota: number;
}
