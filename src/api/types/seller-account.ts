/**
 * Buyer/seller account context (services/user-organization, gateway route /api/v1/marketplace/* =
 * AuthenticatedRoutePolicy: Bearer JWT + active session). Success bodies are enveloped: { success: true, data }.
 * JSON = System.Text.Json web defaults (camelCase, nulls written). DateTimes read from SQL have no "Z" — treat as UTC.
 * See docs/contracts/seller-account.md.
 */

export type Guid = string;
export type IsoDateTime = string;

// ---------------------------------------------------------------------------
// Envelope & errors
// ---------------------------------------------------------------------------

/** C# BaseApiController.MapResult: Ok(new { success = true, data = res.Value }). */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

/** C# anonymous `new { code = "MARKETPLACE_SELLER_ACCESS_DENIED" }` (403; caller has no ACTIVE membership, or seller id unknown). */
export interface MarketplaceAccessDeniedError {
  code: 'MARKETPLACE_SELLER_ACCESS_DENIED';
}

/** C# Emcore.BuildingBlocks.Core.ErrorType.ToString() (or "Error"). */
export type ResultErrorTitle = 'Failure' | 'Validation' | 'NotFound' | 'Conflict' | 'Forbidden' | 'Error';

/**
 * C# ProblemDetails from BaseApiController.MapResult. Internal Error.Code is NOT exposed; detail is "" for all
 * marketplace errors (services set only Error.Code). Status: Validation 400, Forbidden 403, NotFound 404, Conflict 409, else 500.
 */
export interface ResultProblemDetails {
  /** "https://emcore.platform/errors/{status}" */
  type: string;
  title: ResultErrorTitle;
  status: 400 | 403 | 404 | 409 | 500;
  detail: string | null;
  traceId?: string;
}

/** ASP.NET ValidationProblemDetails ([ApiController] automatic 400). Keys: C# PascalCase names or "$.path". */
export interface ValidationProblemDetails {
  type: string;
  title: string;
  status: 400;
  errors: Record<string, string[]>;
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Seller type. C# MarketplaceSellerService.BecomeSellerAsync (input trimmed + upper-cased). */
export type SellerType = 'INDIVIDUAL' | 'BUSINESS';

/** ORGANIZATION.Status for sellers (024 migration). */
export type SellerStatus = 'ACTIVE' | 'SUSPENDED';

/** ORGANIZATION.VerificationStatus (024 migration). */
export type SellerVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/** SELLER_PROFILE.OnboardingStatus (024). UNDER_REVIEW is accepted by admin procs but never set. */
export type SellerOnboardingStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'COMPLETED';

/** SELLER_DOCUMENT.VerificationStatus — only 'UNVERIFIED' is ever written. */
export type SellerDocumentVerificationStatus = 'UNVERIFIED';

// ---------------------------------------------------------------------------
// GET /api/v1/marketplace/actors/me
// ---------------------------------------------------------------------------

/** C# Contracts.Marketplace.BuyerContextResponse. Always { enabled: true }. */
export interface BuyerContext {
  enabled: boolean;
}

/** C# Contracts.Marketplace.SellerContextResponse (#nullable disable => strings may be null). */
export interface SellerContext {
  sellerId: Guid;
  sellerType: SellerType;
  displayName: string | null;
  status: SellerStatus;
  verificationStatus: SellerVerificationStatus;
  onboardingStatus: SellerOnboardingStatus;
  isOwner: boolean;
}

/** C# Contracts.Marketplace.MarketplaceCurrentActorResponse (data of GET actors/me). One sellerContext per ACTIVE membership. */
export interface MarketplaceCurrentActor {
  userId: Guid;
  buyer: BuyerContext;
  sellerContexts: SellerContext[];
}

// ---------------------------------------------------------------------------
// Sellers
// ---------------------------------------------------------------------------

/**
 * C# Contracts.Marketplace.MarketplaceSellerDto (data of POST /sellers, GET /sellers/{id}, POST /submit).
 * email is never mapped (always ""). rowVersion = base64 of 8-byte SQL rowversion (send back as expectedRowVersion).
 */
export interface MarketplaceSeller {
  sellerId: Guid;
  organizationType: SellerType;
  email: string;
  legalName: string | null;
  displayName: string | null;
  registrationNo: string | null;
  countryCode: string;
  defaultCurrency: string;
  status: SellerStatus;
  verificationStatus: SellerVerificationStatus;
  onboardingStatus: SellerOnboardingStatus;
  profileLogoAssetId: Guid | null;
  submittedAtUtc: IsoDateTime | null;
  verifiedAtUtc: IsoDateTime | null;
  rejectedAtUtc: IsoDateTime | null;
  suspendedAtUtc: IsoDateTime | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime;
  rowVersion: string;
}

/** C# Contracts.Marketplace.CreateSellerRequest — POST /api/v1/marketplace/sellers. */
export interface CreateSellerRequest {
  /** required (non-empty) */
  sellerType: SellerType;
  /** required (non-empty); SQL NVARCHAR(200) */
  displayName: string;
  /** required when BUSINESS; SQL NVARCHAR(200) */
  legalName?: string | null;
  /** SQL NVARCHAR(100) */
  registrationNo?: string | null;
  /** required; SQL VARCHAR(3) param — no format validation */
  countryCode: string;
  /** required; SQL VARCHAR(3) param — no format validation */
  defaultCurrency: string;
}

/** C# Api.Controllers.Marketplace.SubmitRequest — POST /api/v1/marketplace/sellers/{id}/submit. */
export interface SubmitSellerRequest {
  /** required (non-empty); MarketplaceSeller.rowVersion */
  expectedRowVersion: string;
}

// ---------------------------------------------------------------------------
// Seller documents
// ---------------------------------------------------------------------------

/** C# Contracts.Marketplace.CreateSellerDocumentRequest. fileAssetId must be an AVAILABLE SELLER_DOCUMENT file owned by the caller. */
export interface CreateSellerDocumentRequest {
  /** required (non-empty); free text, SQL VARCHAR(100) */
  documentType: string;
  fileAssetId: Guid;
  /** SQL NVARCHAR(100) */
  documentNumber?: string | null;
  issuedAt?: IsoDateTime | null;
  expiresAt?: IsoDateTime | null;
}

/** C# Contracts.Marketplace.SellerDocumentResponse. createdAtUtc ends in "Z" on POST (C# value), not on GET (SQL value). */
export interface SellerDocument {
  sellerDocumentId: Guid;
  sellerId: Guid;
  documentType: string;
  fileAssetId: Guid;
  documentNumber: string | null;
  issuedAt: IsoDateTime | null;
  expiresAt: IsoDateTime | null;
  verificationStatus: SellerDocumentVerificationStatus;
  createdAtUtc: IsoDateTime;
}

/** data of DELETE document (C# Result<bool>). NOTE: currently answers 404 even on success. */
export type DeleteSellerDocumentData = boolean;

// Convenience response aliases
export type GetCurrentActorResponse = ApiEnvelope<MarketplaceCurrentActor>;
export type SellerResponse = ApiEnvelope<MarketplaceSeller>;
export type SellerDocumentsResponse = ApiEnvelope<SellerDocument[]>;
export type SellerDocumentResponse = ApiEnvelope<SellerDocument>;
export type DeleteSellerDocumentResponse = ApiEnvelope<DeleteSellerDocumentData>;
