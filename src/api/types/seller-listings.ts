/**
 * Seller self-service listing API + public listing detail (services/catalog-listing).
 * Contract doc: docs/contracts/seller-listings.md
 *
 * Conventions (see doc §1):
 * - Seller endpoints and GET /api/v1/catalog/listings/{id} return BARE DTOs (no {success,data}).
 * - Taxonomy reads (/api/v1/catalog/categories/..., /brands) use ApiResponse<T> (see ./catalog-taxonomy).
 * - Errors: { error: CODE, message } (ErrorResponse). Model validation => 400 { error:"INVALID_DATA", message:"Validation failed" }.
 * - camelCase JSON; decimals are JSON numbers; DateTimes from SQL lack "Z" (treat as UTC).
 * - rowVersion / expectedRowVersion = base64 of an 8-byte SQL rowversion.
 */
// Self-contained (does not import ./catalog-taxonomy so it type-checks standalone under any target).
// The taxonomy shapes below are structurally identical to those in ./catalog-taxonomy (verified vs C#).

/** System.Guid serialized as string. */
export type Guid = string;

/** System.DateTime as ISO-8601 string (SQL-sourced values lack "Z"; always UTC). */
export type IsoDateTime = string;

/** C# Contracts.Responses.ApiResponse<T> — used ONLY by public taxonomy endpoints. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/** C# Contracts.Responses.ErrorResponse — every service-generated error body. */
export interface ErrorResponse {
  error: string;
  message: string | null;
}

/** Gateway problem+json for bodiless 401/403/404/503 (may replace empty-body service responses). */
export interface GatewayProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  instance: string;
}

/** C# Contracts.Categories.PublicCategoryTreeResponse. */
export interface PublicCategoryTreeResponse {
  categoryId: Guid;
  slug: string;
  parentCategoryId: Guid | null;
  name: string;
  children: PublicCategoryTreeResponse[];
}

/** C# Contracts.Attributes.AttributeOptionResponse. */
export interface AttributeOptionResponse {
  attributeOptionId: Guid;
  value: string;
  displayOrder: number;
  isActive: boolean;
  version: number;
}

/** C# Contracts.Attributes.EffectiveCategoryAttributeResponse. */
export interface EffectiveCategoryAttributeResponse {
  attributeDefinitionId: Guid;
  code: string;
  name: string;
  description: string | null;
  dataType: ListingAttributeDataType;
  isRequired: boolean;
  displayOrder: number;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  decimalPrecision: number | null;
  regexPattern: string | null;
  options: AttributeOptionResponse[];
  isInherited: boolean;
  sourceCategoryId: Guid | null;
}

/** C# Contracts.Brands.EffectiveCategoryBrandResponse. */
export interface EffectiveCategoryBrandResponse {
  brandId: Guid;
  code: string;
  name: string;
  description: string | null;
  isInherited: boolean;
  sourceCategoryId: Guid;
}

/** C# Contracts.Brands.PublicBrandResponse. */
export interface PublicBrandResponse {
  brandId: Guid;
  code: string;
  name: string;
  description: string | null;
}

/** C# Contracts.Units.PublicCategoryUnitItem. unitType: COUNT|MASS|LENGTH|AREA|VOLUME|PACKAGE. */
export interface PublicCategoryUnitItem {
  unitId: Guid;
  code: string;
  name: string;
  symbol: string;
  unitType: 'COUNT' | 'MASS' | 'LENGTH' | 'AREA' | 'VOLUME' | 'PACKAGE';
  minQuantity: number | null;
  maxQuantity: number | null;
  quantityDecimalPrecision: number | null;
  isInherited: boolean;
  sourceCategoryId: Guid;
}

/** C# Contracts.Units.PublicCategoryUnitsResponse. */
export interface PublicCategoryUnitsResponse {
  categoryId: Guid;
  defaultUnitId: Guid | null;
  units: PublicCategoryUnitItem[];
}

/** C# Contracts.Conditions.PublicGradeDto. */
export interface PublicGradeDto {
  gradeId: Guid;
  code: string;
  name: string;
}

/** C# Contracts.Conditions.PublicCategoryConditionDto. */
export interface PublicCategoryConditionDto {
  conditionId: Guid;
  code: string;
  name: string;
  isInherited: boolean;
  isGradeRequired: boolean;
  grades: PublicGradeDto[];
}

/** C# Contracts.Conditions.PublicCategoryConditionsResponse. */
export interface PublicCategoryConditionsResponse {
  categoryId: Guid;
  isConditionRequired: boolean;
  conditions: PublicCategoryConditionDto[];
}

/** C# Contracts.Validation.ListingRequirementsResponse. */
export interface ListingRequirementsResponse {
  categoryId: Guid;
  /** R3-A: listings in this exact category need a physical inspection after approval. */
  requiresPhysicalInspection?: boolean;
  attributes: EffectiveCategoryAttributeResponse[];
  brands: EffectiveCategoryBrandResponse[];
  unitRules: PublicCategoryUnitsResponse;
  conditionRules: PublicCategoryConditionsResponse;
}

/** base64 of an 8-byte SQL rowversion, e.g. "AAAAAAAAB9E=". */
export type RowVersion = string;

// ---------------------------------------------------------------------------
// Limits / constants (doc §3-§6)
// ---------------------------------------------------------------------------

export const IDEMPOTENCY_KEY_HEADER = 'X-Idempotency-Key' as const;

export const SELLER_LISTING_LIMITS = {
  /** MarketplaceListingService.cs:110 (and NVARCHAR(255)). */
  TITLE_MAX_LENGTH: 255,
  /** Exactly 3 chars; uppercased server-side. */
  CURRENCY_LENGTH: 3,
  /** X-Idempotency-Key max length on create (MarketplaceListingService.cs:126). */
  IDEMPOTENCY_KEY_MAX_LENGTH: 100,
  /** BasePrice DECIMAL(19,4): >= 0 for drafts, > 0 required to submit. */
  BASE_PRICE_MIN_DRAFT: 0,
  PRICE_DECIMAL_PLACES: 4,
  /** LISTING_LOCATION_REFERENCE columns; longer values silently truncated. */
  LOCATION_COUNTRY_CODE_MAX_LENGTH: 10,
  LOCATION_STATE_MAX_LENGTH: 100,
  LOCATION_CITY_MAX_LENGTH: 100,
  /** Search param NVARCHAR(255). */
  SEARCH_MAX_LENGTH: 255,
  LIST_DEFAULT_PAGE_SIZE: 20,
} as const;

export const LISTING_MEDIA_LIMITS = {
  /** Defaults; overridable by platform settings listing.media.max-images / max-documents. */
  DEFAULT_MAX_IMAGES: 10,
  DEFAULT_MAX_DOCUMENTS: 10,
  DOCUMENT_TYPE_MAX_LENGTH: 100,
  /** inventory-media purpose policies (FileAssetService.cs:32-34). */
  IMAGE_MAX_BYTES: 10 * 1024 * 1024,
  DOCUMENT_MAX_BYTES: 20 * 1024 * 1024,
  IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  DOCUMENT_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
} as const;

export const LISTING_INVENTORY_LIMITS = {
  /** DECIMAL(18,4). */
  QUANTITY_DECIMAL_PLACES: 4,
  REASON_CODE_MAX_LENGTH: 50,
  NOTES_MAX_LENGTH: 500,
  MOVEMENTS_DEFAULT_PAGE_SIZE: 20,
  MOVEMENTS_MAX_PAGE_SIZE: 100,
} as const;

export const LISTING_INSPECTION_LIMITS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** Purpose to use when uploading via /api/v1/files for each listing media type. */
export const LISTING_MEDIA_FILE_PURPOSE = {
  IMAGE: 'LISTING_IMAGE',
  DOCUMENT: 'LISTING_DOCUMENT',
} as const;

// ---------------------------------------------------------------------------
// Enumerations (doc §2)
// ---------------------------------------------------------------------------

/** C# Domain.Listings.ListingStatus (aggregate). */
export type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'EXPIRED' | 'ARCHIVED';
export const LISTING_STATUSES = ['DRAFT', 'PUBLISHED', 'SUSPENDED', 'EXPIRED', 'ARCHIVED'] as const;

/** C# Domain.Listings.ListingVersionStatus. */
export type ListingVersionStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'APPROVED'
  | 'INSPECTION_REQUIRED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

/** Pricing modes accepted by create/update (case-sensitive). */
export type PricingMode = 'FIXED_PRICE' | 'BIDDING' | 'BOTH';
export const PRICING_MODES = ['FIXED_PRICE', 'BIDDING', 'BOTH'] as const;

/** C# Domain.Moderation.ModerationDecision. */
export type ModerationDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

/** C# Domain.Publication.SuspensionReasonCode. */
export type SuspensionReasonCode =
  | 'SELLER_REQUESTED_PAUSE'
  | 'ADMINISTRATIVE_SUSPENSION'
  | 'POLICY_VIOLATION'
  | 'COUNTERFEIT_INVESTIGATION'
  | 'SELLER_ACCOUNT_SUSPENDED'
  | 'ADMINISTRATIVE_HOLD';

/** LISTING_VERSION_MEDIA.MediaType (CHECK constraint). */
export type ListingMediaType = 'IMAGE' | 'DOCUMENT';

/** Listing list sort values (MIG/025:211); anything else falls back to CreatedAtUtcDesc. */
export type SellerListingSort = 'CreatedAtUtcDesc' | 'CreatedAtUtcAsc' | 'TitleAsc' | 'TitleDesc';
export const SELLER_LISTING_SORTS = ['CreatedAtUtcDesc', 'CreatedAtUtcAsc', 'TitleAsc', 'TitleDesc'] as const;

/** Attribute data types (same as taxonomy AttributeDataType). */
export type ListingAttributeDataType =
  | 'TEXT'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT';

/** LISTING_INVENTORY_MOVEMENT.MovementType values written by MIG/032. */
export type InventoryMovementType =
  | 'INITIAL'
  | 'MANUAL_SET'
  | 'MANUAL_INCREASE'
  | 'MANUAL_DECREASE'
  | 'RESERVATION_CREATED'
  | 'RESERVATION_RELEASED'
  | 'RESERVATION_CONSUMED'
  | 'RESERVATION_EXPIRED_BATCH';

/** C# LISTING_INSPECTION.Status CHECK. */
export type InspectionStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
/** C# LISTING_INSPECTION.Result CHECK. */
export type InspectionResult = 'PASS' | 'FAIL' | 'REINSPECTION_REQUIRED';
/** C# LISTING_INSPECTION_RESPONSE.ItemResult CHECK. */
export type InspectionItemResult = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
/** INSPECTION_CHECKLIST_TEMPLATE_ITEM.ResponseType CHECK. */
export type InspectionResponseType = 'PASS_FAIL' | 'YES_NO' | 'TEXT' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT';
/** LISTING_INSPECTION_EVIDENCE.EvidenceType CHECK. */
export type InspectionEvidenceType = 'IMAGE' | 'DOCUMENT';

// ---------------------------------------------------------------------------
// Error codes (doc §3-§7). Branch on `error`, never on `message`.
// ---------------------------------------------------------------------------

export type SellerAccessErrorCode =
  | 'UNAUTHORIZED' // 401 (filter); a bare 401 has no body
  | 'MARKETPLACE_SELLER_ACCESS_DENIED' // 403 (create/list/detail/update/attrs/validate/media/inventory/inspections)
  | 'MARKETPLACE_SELLER_NOT_AUTHORIZED' // 403 (submit/moderation-status/pause/resume/archive)
  | 'MARKETPLACE_LISTING_ACCESS_DENIED' // 403 listing belongs to another seller (PR_LISTING_GET_BY_ID)
  | 'MARKETPLACE_LISTING_DEPENDENCY_UNAVAILABLE' // 503
  | 'SERVICE_UNAVAILABLE'; // 503

export type ListingErrorCode =
  | SellerAccessErrorCode
  | 'INVALID_DATA' // 400
  | 'INVALID_ROW_VERSION' // 400 (submit/pause/resume/archive: non-base64)
  | 'MARKETPLACE_LISTING_ROW_VERSION_INVALID' // 400 (attributes/media)
  | 'MARKETPLACE_LISTING_CURRENCY_INVALID' // 400
  | 'MARKETPLACE_LISTING_PRICE_INVALID' // 400 (also invalid pricingMode)
  | 'MARKETPLACE_LISTING_LOCATION_INVALID' // 400
  | 'MARKETPLACE_LISTING_CATEGORY_INVALID' // 400
  | 'MARKETPLACE_LISTING_BRAND_INVALID' // 400
  | 'MARKETPLACE_LISTING_CONDITION_INVALID' // 400
  | 'MARKETPLACE_LISTING_GRADE_INVALID' // 400
  | 'MARKETPLACE_LISTING_UNIT_INVALID' // 400
  | 'MARKETPLACE_LISTING_NOT_FOUND' // 404
  | 'MARKETPLACE_LISTING_VERSION_NOT_FOUND' // 404
  | 'MARKETPLACE_LISTING_IDEMPOTENCY_CONFLICT' // 409
  | 'MARKETPLACE_LISTING_VERSION_CONFLICT' // 409
  | 'MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID' // 409 (403 from resume C# check)
  | 'MARKETPLACE_LISTING_TRANSITION_INVALID' // 409
  | 'MARKETPLACE_LISTING_NOT_READY_FOR_SUBMISSION' // 409
  | 'MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION' // 409
  | 'MARKETPLACE_LISTING_INSPECTION_NOT_PASSED' // 409
  | 'MARKETPLACE_LISTING_NOT_PUBLISHED' // 409 (pause)
  | 'MARKETPLACE_LISTING_RESERVATION_ACTIVE' // 409 (archive)
  | 'MARKETPLACE_SELLER_RESUME_BLOCKED' // 403 (resume after admin suspension)
  | 'MARKETPLACE_INVENTORY_UNIT_CHANGE_BLOCKED' // 409 (update with stock)
  | 'MARKETPLACE_LISTING_INTERNAL_ERROR' // 500
  | 'INTERNAL_SERVER_ERROR'; // 500

export type ListingAttributesErrorCode =
  | ListingErrorCode
  | 'MARKETPLACE_LISTING_SCHEMA_NOT_FOUND' // 404
  | 'MARKETPLACE_LISTING_ATTRIBUTE_DUPLICATE' // 400
  | 'MARKETPLACE_LISTING_ATTRIBUTE_NOT_ALLOWED' // 400
  | 'MARKETPLACE_LISTING_ATTRIBUTE_CARDINALITY_INVALID' // 400
  | 'MARKETPLACE_LISTING_ATTRIBUTE_OPTION_INVALID' // 400
  | 'MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID' // 400
  | 'MARKETPLACE_LISTING_BAD_REQUEST' // 400 fallback
  | 'MARKETPLACE_LISTING_FORBIDDEN' // 403 fallback
  | 'MARKETPLACE_LISTING_CONFLICT'; // 409 fallback

export type ListingMediaErrorCode =
  | ListingErrorCode
  | 'MARKETPLACE_LISTING_MEDIA_TYPE_INVALID' // 400
  | 'MARKETPLACE_LISTING_PRIMARY_IMAGE_INVALID' // 400
  | 'MARKETPLACE_LISTING_MEDIA_ORDER_INVALID' // 400
  | 'MARKETPLACE_LISTING_MEDIA_NOT_FOUND' // 404
  | 'MARKETPLACE_LISTING_MEDIA_INVALID' // 409 (file not AVAILABLE / wrong purpose / not uploaded by caller)
  | 'MARKETPLACE_LISTING_MEDIA_ALREADY_ATTACHED' // 409
  | 'MARKETPLACE_LISTING_MAX_IMAGES_EXCEEDED' // 409
  | 'MARKETPLACE_LISTING_MAX_DOCUMENTS_EXCEEDED'; // 409

export type ListingInventoryErrorCode =
  | SellerAccessErrorCode
  | 'INVALID_DATA' // 400
  | 'MARKETPLACE_INVENTORY_ROW_VERSION_INVALID' // 400
  | 'MARKETPLACE_INVENTORY_QUANTITY_INVALID' // 400
  | 'MARKETPLACE_INVENTORY_ADJUSTMENT_INVALID' // 400
  | 'MARKETPLACE_LISTING_NOT_FOUND' // 404
  | 'MARKETPLACE_INVENTORY_NOT_FOUND' // 404
  | 'MARKETPLACE_INVENTORY_VERSION_CONFLICT' // 409
  | 'MARKETPLACE_INVENTORY_QUANTITY_BELOW_RESERVED' // 409
  | 'MARKETPLACE_LISTING_TRANSITION_INVALID' // 409 (ARCHIVED listing)
  | 'MARKETPLACE_LISTING_INTERNAL_ERROR'; // 500

export type ListingInspectionErrorCode =
  | SellerAccessErrorCode
  | 'INVALID_DATA' // 400
  | 'MARKETPLACE_INSPECTION_REQUEST_INVALID' // 400
  | 'MARKETPLACE_INSPECTION_ACCESS_DENIED' // 403
  | 'MARKETPLACE_INSPECTION_NOT_FOUND' // 404
  | 'MARKETPLACE_INSPECTION_REINSPECTION_INVALID'; // 409

/** Codes inside ValidateListingResponse.errors[].code (ListingValidationService.cs). */
export type ListingValidationErrorCode =
  | 'MARKETPLACE_LISTING_TITLE_REQUIRED'
  | 'MARKETPLACE_LISTING_PRICING_MODE_INVALID'
  | 'MARKETPLACE_LISTING_CURRENCY_INVALID'
  | 'MARKETPLACE_LISTING_PRICE_INVALID'
  | 'MARKETPLACE_LISTING_BRAND_INVALID'
  | 'MARKETPLACE_LISTING_UNIT_INVALID'
  | 'MARKETPLACE_LISTING_CONDITION_INVALID'
  | 'MARKETPLACE_LISTING_GRADE_INVALID'
  | 'MARKETPLACE_LISTING_ATTRIBUTE_NOT_ALLOWED'
  | 'MARKETPLACE_LISTING_REQUIRED_ATTRIBUTE_MISSING'
  | 'MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID'
  | 'MARKETPLACE_LISTING_ATTRIBUTE_DUPLICATE'
  | 'MARKETPLACE_LISTING_ATTRIBUTE_OPTION_INVALID'
  | 'MARKETPLACE_LISTING_VALIDATION_FAILED';

// ---------------------------------------------------------------------------
// Listing CRUD (CT/Listings/ListingDtos.cs)
// ---------------------------------------------------------------------------

/** C# LocationDto. All three required when the object is sent (else 400 INVALID_DATA). */
export interface LocationDto {
  countryCode: string;
  stateOrEmirate: string;
  city: string;
}

/** C# CreateListingDraftRequest. POST .../listings (requires X-Idempotency-Key). */
export interface CreateListingDraftRequest {
  categoryId: Guid;
  title: string;
  pricingMode: PricingMode;
  currency: string;
  description?: string | null;
  basePrice: number;
  brandId?: Guid | null;
  conditionId?: Guid | null;
  gradeId?: Guid | null;
  quantityUnitId?: Guid | null;
  location?: LocationDto | null;
  /** Send ISO-8601 with "Z". */
  expiresAtUtc?: IsoDateTime | null;
}

/** C# CreateListingDraftResponse (HTTP 200). */
export interface CreateListingDraftResponse {
  listingId: Guid;
  currentDraftVersionId: Guid;
  versionNumber: number;
  status: ListingStatus;
  rowVersion: RowVersion;
}

/** C# UpdateListingDraftRequest. PUT .../listings/{id}. Full replacement: null clears optional fields. */
export interface UpdateListingDraftRequest {
  title: string;
  description: string | null;
  categoryId: Guid;
  pricingMode: PricingMode;
  currency: string;
  basePrice: number;
  brandId: Guid | null;
  conditionId: Guid | null;
  gradeId: Guid | null;
  quantityUnitId: Guid | null;
  location: LocationDto | null;
  expiresAtUtc: IsoDateTime | null;
  expectedRowVersion: RowVersion;
}

/** Anonymous `new { RowVersion }` returned by PUT .../listings/{id}. */
export interface UpdateListingDraftResponse {
  rowVersion: RowVersion;
}

/** C# ListingVersionDto (no version status, no timestamps). */
export interface ListingVersionDto {
  listingVersionId: Guid;
  versionNumber: number;
  /** R3-A: snapshotted from the category when the version was created. */
  requiresPhysicalInspection?: boolean;
  categoryId: Guid;
  title: string;
  description: string | null;
  pricingMode: PricingMode;
  currency: string;
  basePrice: number;
  brandId: Guid | null;
  conditionId: Guid | null;
  gradeId: Guid | null;
  quantityUnitId: Guid | null;
  location: LocationDto | null;
}

/** C# ListingDetailResponse. GET .../listings/{id}. */
export interface ListingDetailResponse {
  listingId: Guid;
  sellerId: Guid;
  status: ListingStatus;
  currentDraftVersionId: Guid | null;
  publishedVersionId: Guid | null;
  expiresAtUtc: IsoDateTime | null;
  rowVersion: RowVersion;
  currentDraftVersion: ListingVersionDto | null;
  publishedVersion: ListingVersionDto | null;
}

/** Query for GET .../listings (MarketplaceListingsController.cs:62-76). */
export interface SellerListingListQuery {
  page?: number; // default 1
  pageSize?: number; // default 20, NO max
  status?: ListingStatus;
  categoryId?: Guid;
  search?: string;
  sort?: SellerListingSort; // default CreatedAtUtcDesc
}

/** C# SellerListingListItemResponse. title/categoryId from draft version, else published version. */
export interface SellerListingListItemResponse {
  listingId: Guid;
  /** R3-A: the current version's physical-inspection flag. */
  requiresPhysicalInspection?: boolean;
  sellerId: Guid;
  status: ListingStatus;
  currentDraftVersionId: Guid | null;
  publishedVersionId: Guid | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  title: string;
  categoryId: Guid;
}

/** C# SellerListingListResponse (no page echo). */
export interface SellerListingListResponse {
  items: SellerListingListItemResponse[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Moderation (CT/Moderation/ModerationDtos.cs)
// ---------------------------------------------------------------------------

/** C# SubmitListingRequest. POST .../submit (requires X-Idempotency-Key; key is ignored). */
export interface SubmitListingRequest {
  listingVersionId: Guid; // must equal currentDraftVersionId
  expectedRowVersion: RowVersion;
}

/** C# SubmitListingResponse. status is the VERSION status ("UNDER_REVIEW"). */
export interface SubmitListingResponse {
  listingId: Guid;
  listingVersionId: Guid;
  status: ListingVersionStatus;
  submittedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

/**
 * C# ListingModerationStatusResponse. GET .../moderation-status.
 * listingVersionId is the all-zero GUID when there is no draft.
 * status: BUGGY — always "DRAFT" while a draft exists (defect D1); otherwise the listing status.
 */
export interface ListingModerationStatusResponse {
  listingId: Guid;
  listingVersionId: Guid;
  status: ListingVersionStatus | ListingStatus;
  reviewedAtUtc: IsoDateTime | null;
  decision: ModerationDecision | null;
  reasonCode: string | null;
  sellerNotes: string | null;
}

// ---------------------------------------------------------------------------
// Pause / resume / archive (CT/Publication/PublicationDtos.cs)
// ---------------------------------------------------------------------------

/** C# SellerPauseListingRequest. */
export interface SellerPauseListingRequest {
  remarks?: string | null;
  expectedRowVersion: RowVersion;
}

/** C# SuspendListingResponse (pause => status "SUSPENDED", reasonCode "SELLER_REQUESTED_PAUSE"). */
export interface SuspendListingResponse {
  listingId: Guid;
  status: ListingStatus;
  reasonCode: SuspensionReasonCode;
  updatedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

/** C# SellerResumeListingRequest. */
export interface SellerResumeListingRequest {
  expectedRowVersion: RowVersion;
}

/** C# RepublishListingResponse (resume => status "PUBLISHED"). */
export interface RepublishListingResponse {
  listingId: Guid;
  publishedVersionId: Guid;
  status: ListingStatus;
  updatedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

/** C# ArchiveListingRequest. */
export interface ArchiveListingRequest {
  expectedRowVersion: RowVersion;
}

/** C# ArchiveListingResponse (status "ARCHIVED"). */
export interface ArchiveListingResponse {
  listingId: Guid;
  status: ListingStatus;
  updatedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

// ---------------------------------------------------------------------------
// Attributes + validation (CT/Listings/ListingAttributeDtos.cs, CT/Validation/ListingSubmissionDto.cs)
// ---------------------------------------------------------------------------

/**
 * C# SubmittedAttributeDto. Values are strings encoded by dataType:
 * TEXT raw; INTEGER "123"; DECIMAL "12.5"; BOOLEAN "true"/"false"; DATE "yyyy-MM-dd";
 * SINGLE_SELECT [optionId]; MULTI_SELECT [optionId,...]. Empty/blank values => attribute not stored.
 */
export interface SubmittedAttributeDto {
  attributeDefinitionId: Guid;
  values: string[];
}

/** C# ReplaceListingAttributesRequest. PUT .../attributes (replaces full set on current draft). */
export interface ReplaceListingAttributesRequest {
  expectedRowVersion: RowVersion;
  attributes: SubmittedAttributeDto[];
}

/** C# ListingAttributeValueResponse. */
export interface ListingAttributeValueResponse {
  attributeDefinitionId: Guid;
  dataType: ListingAttributeDataType;
  values: string[];
}

/** C# ListingAttributesResponse. rowVersion = LISTING rowVersion. */
export interface ListingAttributesResponse {
  listingId: Guid;
  listingVersionId: Guid;
  rowVersion: RowVersion;
  attributes: ListingAttributeValueResponse[];
}

/** C# ListingValidationErrorResponse. field: title|pricingMode|currency|basePrice|brandId|unitId|conditionId|gradeId|attributes|attributes.{guid}|system. */
export interface ListingValidationErrorResponse {
  code: ListingValidationErrorCode;
  field: string;
  attributeDefinitionId: Guid | null;
  message: string;
}

/** C# ValidateListingResponse. POST .../validate (advisory; submit does not run it). */
export interface ValidateListingResponse {
  listingId: Guid;
  listingVersionId: Guid;
  isValid: boolean;
  errors: ListingValidationErrorResponse[];
}

// ---------------------------------------------------------------------------
// Media (CT/Listings/ListingMediaDtos.cs)
// ---------------------------------------------------------------------------

/** C# AttachListingMediaRequest. fileAssetId = /api/v1/files fileId (purpose LISTING_IMAGE|LISTING_DOCUMENT, uploaded by caller). */
export interface AttachListingMediaRequest {
  expectedRowVersion: RowVersion;
  fileAssetId: Guid;
  mediaType: ListingMediaType;
  isPrimary: boolean; // must be false for DOCUMENT; first IMAGE is always primary
  documentType?: string | null;
}

/** C# ListingMediaMutationRequest (DELETE media, PUT primary). DELETE needs this JSON body. */
export interface ListingMediaMutationRequest {
  expectedRowVersion: RowVersion;
}

/** C# ReorderListingMediaRequest. Must list exactly all IMAGE fileAssetIds of the draft. */
export interface ReorderListingMediaRequest {
  expectedRowVersion: RowVersion;
  orderedFileAssetIds: Guid[];
}

/** C# ListingMediaItemResponse. */
export interface ListingMediaItemResponse {
  listingVersionMediaId: Guid;
  fileAssetId: Guid;
  mediaType: ListingMediaType;
  displayOrder: number;
  isPrimary: boolean;
  documentType: string | null;
}

/** C# ListingMediaResponse. GET .../media (IMAGEs first, then displayOrder). */
export interface ListingMediaResponse {
  listingId: Guid;
  listingVersionId: Guid;
  rowVersion: RowVersion;
  media: ListingMediaItemResponse[];
}

/** C# AttachListingMediaResponse. */
export interface AttachListingMediaResponse {
  listingId: Guid;
  listingVersionId: Guid;
  fileAssetId: Guid;
  rowVersion: RowVersion;
  association: ListingMediaItemResponse;
}

/** C# ListingMediaMutationResponse (DELETE / PUT primary / PUT order). */
export interface ListingMediaMutationResponse {
  rowVersion: RowVersion;
}

// ---------------------------------------------------------------------------
// Inventory (CT/Inventory/ListingInventoryDtos.cs). Separate inventory rowVersion.
// ---------------------------------------------------------------------------

/** C# ListingInventoryResponse. rowVersion null => no inventory row yet (use initial set). */
export interface ListingInventoryResponse {
  listingId: Guid;
  onHandQuantity: number;
  reservedQuantity: number;
  sellableQuantity: number;
  quantityUnitId: Guid | null;
  rowVersion: RowVersion | null;
}

/** C# SetListingInventoryRequest. expectedRowVersion null/omitted => initial set (only if no row). */
export interface SetListingInventoryRequest {
  expectedRowVersion?: RowVersion | null;
  onHandQuantity: number; // >= 0, >= reserved
  reasonCode?: string | null; // free text, <=50 (ignored on initial set)
  notes?: string | null; // <=500 (ignored on initial set)
}

/** C# AdjustListingInventoryRequest. */
export interface AdjustListingInventoryRequest {
  expectedRowVersion: RowVersion;
  quantityDelta: number; // != 0
  reasonCode?: string | null;
  notes?: string | null;
}

/** Query for GET .../inventory/movements. */
export interface InventoryMovementsQuery {
  page?: number; // default 1
  pageSize?: number; // default 20, clamped to 100
}

/** C# ListingInventoryMovementItemDto. */
export interface ListingInventoryMovementItemDto {
  movementId: Guid;
  movementType: InventoryMovementType;
  onHandQuantityDelta: number;
  reservedQuantityDelta: number;
  onHandQuantityBefore: number;
  onHandQuantityAfter: number;
  reservedQuantityBefore: number;
  reservedQuantityAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  reasonCode: string | null;
  notes: string | null;
  createdByUserId: Guid | null;
  createdAtUtc: IsoDateTime;
}

/** C# ListingInventoryMovementsResponse (page/pageSize echo clamped values). */
export interface ListingInventoryMovementsResponse {
  listingId: Guid;
  page: number;
  pageSize: number;
  totalCount: number;
  items: ListingInventoryMovementItemDto[];
}

// ---------------------------------------------------------------------------
// Inspections, seller view (CT/Inspections/InspectionDtos.cs)
// ---------------------------------------------------------------------------

/** Query for GET .../inspections. */
export interface SellerInspectionsQuery {
  page?: number;
  pageSize?: number; // SQL clamps to 100; response echoes raw value
}

/** C# InspectionSummaryDto. */
export interface InspectionSummaryDto {
  inspectionId: Guid;
  inspectionNo: string;
  listingId: Guid;
  listingVersionId: Guid;
  inspectionChecklistTemplateId: Guid;
  status: InspectionStatus;
  result: InspectionResult | null;
  assignedInspectorUserId: Guid | null;
  assignedByUserId: Guid | null;
  assignedAtUtc: IsoDateTime | null;
  startedAtUtc: IsoDateTime | null;
  completedAtUtc: IsoDateTime | null;
  cancelledAtUtc: IsoDateTime | null;
  summary: string | null;
  failureReasonCode: string | null;
  failureNotes: string | null;
  reinspectionOfInspectionId: Guid | null;
  createdByUserId: Guid;
  createdAtUtc: IsoDateTime;
  updatedByUserId: Guid | null;
  updatedAtUtc: IsoDateTime | null;
  rowVersion: RowVersion;
  sellerId: Guid | null;
  listingTitle: string | null;
}

/** C# InspectionResponseDto. */
export interface InspectionResponseDto {
  inspectionResponseId: Guid;
  inspectionId: Guid;
  sourceTemplateItemId: Guid;
  itemCodeSnapshot: string;
  itemLabelSnapshot: string;
  itemDescriptionSnapshot: string | null;
  responseTypeSnapshot: InspectionResponseType;
  isRequiredSnapshot: boolean;
  requiresEvidenceSnapshot: boolean;
  displayOrderSnapshot: number;
  passFailValue: string | null;
  yesNoValue: boolean | null;
  textValue: string | null;
  numberValue: number | null;
  singleSelectValue: string | null;
  multiSelectValueJson: string | null;
  inspectorNotes: string | null;
  itemResult: InspectionItemResult | null;
  answeredAtUtc: IsoDateTime | null;
}

/** C# InspectionEvidenceDto. */
export interface InspectionEvidenceDto {
  inspectionEvidenceId: Guid;
  inspectionId: Guid;
  inspectionResponseId: Guid | null;
  fileAssetId: Guid;
  evidenceType: InspectionEvidenceType;
  description: string | null;
  displayOrder: number;
  createdByUserId: Guid;
  createdAtUtc: IsoDateTime;
  downloadUrl: string | null;
}

/** C# InspectionStatusHistoryDto (always empty for sellers). */
export interface InspectionStatusHistoryDto {
  inspectionStatusHistoryId: Guid;
  inspectionId: Guid;
  fromStatus: InspectionStatus | null;
  toStatus: InspectionStatus;
  result: InspectionResult | null;
  action: string;
  changedByUserId: Guid;
  reasonCode: string | null;
  notes: string | null;
  changedAtUtc: IsoDateTime;
}

/** C# InspectionAssignmentHistoryDto (always empty for sellers). */
export interface InspectionAssignmentHistoryDto {
  assignmentHistoryId: Guid;
  inspectionId: Guid;
  previousInspectorUserId: Guid | null;
  newInspectorUserId: Guid;
  assignedByUserId: Guid;
  reasonCode: string | null;
  notes: string | null;
  assignedAtUtc: IsoDateTime;
}

/** C# InspectionDetailDto. GET .../inspections/latest (404 empty body when none). */
export interface InspectionDetailDto extends InspectionSummaryDto {
  responses: InspectionResponseDto[];
  evidence: InspectionEvidenceDto[];
  statusHistory: InspectionStatusHistoryDto[];
  assignmentHistory: InspectionAssignmentHistoryDto[];
}

/** C# PagedInspectionQueueResponse. GET .../inspections. */
export interface PagedInspectionQueueResponse {
  items: InspectionSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** C# SellerRequestReinspectionRequest. POST .../inspections/{id}/request-reinspection => 202, empty body. */
export interface SellerRequestReinspectionRequest {
  remediationNotes: string;
}

// ---------------------------------------------------------------------------
// Public listing detail (CT/Publication/PublicationDtos.cs) — GET /api/v1/catalog/listings/{id}
// ---------------------------------------------------------------------------

/** C# PublishedListingImageDto. cdnUrl = "/api/v1/files/{fileAssetId}/download" (route does not exist; defect D5). */
export interface PublishedListingImageDto {
  fileAssetId: Guid;
  cdnUrl: string;
}

/** C# PublishedListingSellerDto. */
export interface PublishedListingSellerDto {
  sellerId: Guid;
  displayName: string; // fallback "Marketplace Seller"
  entityType: string; // seller organization type; fallback "BUSINESS"
  isVerified: boolean;
}

/** C# PublishedListingLocationDto (missing parts are ""). */
export interface PublishedListingLocationDto {
  countryCode: string;
  stateOrEmirate: string;
  city: string;
}

/** C# PublicListingGalleryImageDto. */
export interface PublicListingGalleryImageDto {
  fileAssetId: Guid;
  cdnUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

/** C# PublicListingAttributeDetailDto. numValue === numericValue. MULTI_SELECT => both values null (defect D13). */
export interface PublicListingAttributeDetailDto {
  code: string;
  name: string;
  textValue: string | null;
  numValue: number | null;
  numericValue: number | null;
}

/** C# PublicListingDetailResponse (HTTP 200, bare). */
export interface PublicListingDetailResponse {
  listingId: Guid;
  listingVersionId: Guid; // == publishedVersionId
  publishedVersionId: Guid;
  versionNumber: number;
  listingNumber: string; // "LST-XXXXXXXX"
  title: string;
  description: string | null;
  pricingMode: PricingMode;
  basePrice: number;
  currency: string;
  quantityUnitId: Guid | null;
  quantityUnitName: string | null;
  quantityUnitSymbol: string | null;
  unitOfMeasure: string | null; // symbol ?? name
  categoryId: Guid;
  categoryName: string;
  categoryBreadcrumb: string[]; // root -> leaf names
  categoryPathIds: string[]; // root -> leaf ids (as strings)
  brandId: Guid | null;
  brandName: string | null;
  conditionId: Guid | null;
  conditionName: string | null;
  gradeId: Guid | null;
  gradeName: string | null;
  sellableQuantity: number;
  sellableOnHandQuantity: number; // == sellableQuantity
  isAvailable: boolean; // sellableQuantity > 0
  expiresAtUtc: IsoDateTime | null;
  publishedAtUtc: IsoDateTime;
  location: PublishedListingLocationDto;
  primaryImage: PublishedListingImageDto | null;
  primaryMediaUrl: string | null;
  galleryImages: PublicListingGalleryImageDto[];
  galleryMediaUrls: string[];
  attributes: PublicListingAttributeDetailDto[];
  seller: PublishedListingSellerDto;
}

/** C# PublicListingUnavailableResponse (HTTP 410: SUSPENDED/EXPIRED or seller not in good standing). */
export interface PublicListingUnavailableResponse {
  listingId: Guid;
  error: 'MARKETPLACE_LISTING_UNAVAILABLE';
  message: string;
  alertBanner: string;
  isAvailable: false;
}

/** Discriminated result for GET /api/v1/catalog/listings/{id}. */
export type PublicListingDetailResult =
  | { status: 200; body: PublicListingDetailResponse }
  | { status: 410; body: PublicListingUnavailableResponse }
  | { status: 404; body: ErrorResponse | GatewayProblemDetails | null } // error "MARKETPLACE_LISTING_NOT_FOUND"
  | { status: 503; body: ErrorResponse }; // error "SERVICE_UNAVAILABLE"

// ---------------------------------------------------------------------------
// Public taxonomy envelopes (bodies wrapped in ApiResponse<T>)
// ---------------------------------------------------------------------------

export type PublicCategoryTreeEnvelope = ApiResponse<PublicCategoryTreeResponse[]>;
export type ListingRequirementsEnvelope = ApiResponse<ListingRequirementsResponse>;
export type PublicCategoryUnitsEnvelope = ApiResponse<PublicCategoryUnitsResponse>;
export type PublicCategoryAttributesEnvelope = ApiResponse<EffectiveCategoryAttributeResponse[]>;
export type PublicCategoryBrandsEnvelope = ApiResponse<EffectiveCategoryBrandResponse[]>;
export type PublicCategoryConditionsEnvelope = ApiResponse<PublicCategoryConditionsResponse>;
export type PublicBrandListEnvelope = ApiResponse<PublicBrandResponse[]>;
export type PublicBrandEnvelope = ApiResponse<PublicBrandResponse>;

// ---------------------------------------------------------------------------
// Lifecycle helpers (doc §8) — derived strictly from the SQL guards.
// ---------------------------------------------------------------------------

/** Actions the seller API will accept, given what the API exposes (version status is NOT readable; see D1). */
export interface SellerListingActionAvailability {
  canUpdateDraft: boolean;
  canEditAttributes: boolean;
  canMutateMedia: boolean;
  canEditInventory: boolean;
  canSubmit: boolean; // additionally requires version DRAFT|CHANGES_REQUIRED, basePrice > 0, >= 1 media
  canPause: boolean;
  canResume: boolean; // additionally requires last suspension reason SELLER_REQUESTED_PAUSE
  canArchive: boolean;
}

/** Status-level gating per MIG/032:1317, MIG/027:51, MIG/030:65, MIG/032:111, MIG/036 (pause/resume/archive). */
export function getSellerListingActions(detail: Pick<ListingDetailResponse, 'status' | 'currentDraftVersionId' | 'expiresAtUtc'>, nowUtc: Date = new Date()): SellerListingActionAvailability {
  const hasDraft = detail.currentDraftVersionId !== null;
  const expiry = detail.expiresAtUtc !== null ? Date.parse(detail.expiresAtUtc.endsWith('Z') ? detail.expiresAtUtc : `${detail.expiresAtUtc}Z`) : null;
  const pastExpiry = expiry !== null && expiry <= nowUtc.getTime();
  const effectivelyPublished = detail.status === 'PUBLISHED' && !pastExpiry;
  return {
    canUpdateDraft: hasDraft && detail.status === 'DRAFT',
    canEditAttributes: hasDraft && detail.status === 'DRAFT',
    canMutateMedia: hasDraft && (detail.status === 'DRAFT' || detail.status === 'PUBLISHED'),
    canEditInventory: detail.status !== 'ARCHIVED',
    canSubmit: hasDraft && detail.status === 'DRAFT',
    canPause: effectivelyPublished,
    canResume: detail.status === 'SUSPENDED' && !pastExpiry,
    canArchive: !effectivelyPublished,
  };
}
