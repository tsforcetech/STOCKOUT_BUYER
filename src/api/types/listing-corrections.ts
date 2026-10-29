/**
 * E5 inspector listing corrections — seller view (CatalogListing MarketplaceListingCorrectionsController).
 * No response envelope; errors are { error, message }. Never contains inspector identity or private notes.
 */
import type { Guid, IsoDateTime, RowVersion } from "./seller-listings";

export type CorrectionStatus =
  | "AWAITING_SELLER_DECISION"
  | "READY_FOR_MODERATION"
  | "SELLER_ACCEPTED"
  | "SUBMITTED_TO_MODERATION"
  | "SELLER_DECLINED"
  | "WITHDRAWN";

export interface CorrectionFieldComparisonDto {
  /** title | description | condition | grade | price | quantity | media */
  field: string;
  before: string | null;
  after: string | null;
  requiresSellerAcceptance: boolean;
}

export interface SellerListingCorrectionDto {
  correctionId: Guid;
  correctionNo: string;
  listingId: Guid;
  baseListingVersionId: Guid;
  inspectionId: Guid;
  status: CorrectionStatus;
  requiresSellerAcceptance: boolean;
  sellerVisibleSummary: string;
  changes: CorrectionFieldComparisonDto[];
  /** BLOCKED_PENDING_OWNER_DECISION: a proposed quantity is recorded, never applied (E5-Q1). */
  quantityApplicationStatus: string;
  sellerDecision: "ACCEPT" | "DECLINE" | null;
  sellerDecisionAtUtc: IsoDateTime | null;
  sellerDecisionReason: string | null;
  disputeRequestedAtUtc: IsoDateTime | null;
  correctedListingVersionId: Guid | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  rowVersion: RowVersion;
}

export interface PagedSellerCorrectionsResponse {
  items: SellerListingCorrectionDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface SellerCorrectionsQuery {
  listingId?: string;
  status?: CorrectionStatus;
  page: number;
  pageSize: number;
}

export interface SellerCorrectionDecisionRequest {
  decision: "ACCEPT" | "DECLINE";
  /** Required for DECLINE (≤2000). */
  reason?: string | null;
  expectedRowVersion?: RowVersion | null;
}

export interface SellerCorrectionDecisionResponse {
  correction: SellerListingCorrectionDto;
  isIdempotentReplay: boolean;
  /** ACCEPT: SUBMITTED_TO_MODERATION | PENDING_MODERATION_ENTRY. */
  moderationEntryStatus: "SUBMITTED_TO_MODERATION" | "PENDING_MODERATION_ENTRY" | null;
  moderationEntryBlockedCode: string | null;
  /** DECLINE: true when the existing request-reinspection endpoint accepts this inspection. */
  reinspectionRequestEligible: boolean | null;
}

export const CORRECTION_DECLINE_REASON_MAX = 2000;
