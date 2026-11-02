/**
 * E5-DISP-1/2 seller inspection disputes and appeals (CatalogListing MarketplaceListingDisputesController, DisputeDtos.cs).
 * No envelope; errors are { error, message }. Seller DTOs never include internal notes or staff identities.
 */
import type { Guid, IsoDateTime, RowVersion } from "./seller-listings";

export type DisputeType = "INSPECTION_APPEAL" | "CORRECTION_DECLINE_DISPUTE";
export type DisputeStatus = "SUBMITTED" | "APPROVED_FOR_REINSPECTION" | "REJECTED";

/** Private InventoryMedia purposes the backend accepts as evidence (LISTING_IMAGE is rejected). */
export type DisputeEvidencePurpose = "SELLER_DOCUMENT" | "LISTING_DOCUMENT" | "INSPECTION_EVIDENCE" | "GENERAL_ATTACHMENT";

export interface SubmitDisputeEvidenceItemRequest {
  fileAssetId: Guid;
  /** IMAGE | DOCUMENT */
  evidenceType: "IMAGE" | "DOCUMENT";
  filePurpose?: DisputeEvidencePurpose | null;
  description?: string | null;
  displayOrder: number;
}

export interface SubmitInspectionDisputeRequest {
  disputeType: DisputeType;
  /** Required for CORRECTION_DECLINE_DISPUTE (the correction must be SELLER_DECLINED). */
  correctionId?: Guid | null;
  /** ≤50, free text code (not validated against a list). */
  reasonCode: string;
  /** 10–2000 characters. */
  reason: string;
  /** At least one completed, private file uploaded by this user. */
  evidence: SubmitDisputeEvidenceItemRequest[];
}

export interface InspectionDisputeEvidenceDto {
  disputeEvidenceId: Guid;
  fileAssetId: Guid;
  evidenceType: string;
  description: string | null;
  displayOrder: number;
  createdAtUtc: IsoDateTime;
  /** Short-lived signed URL. */
  downloadUrl: string | null;
  expiresAtUtc: IsoDateTime | null;
}

export interface SellerInspectionDisputeDto {
  disputeId: Guid;
  disputeNo: string;
  listingId: Guid;
  listingVersionId: Guid;
  inspectionId: Guid;
  inspectionNo: string | null;
  correctionId: Guid | null;
  correctionNo: string | null;
  disputeType: DisputeType;
  status: DisputeStatus;
  disputedInspectionResult: string;
  reasonCode: string;
  sellerReason: string;
  requiresDifferentInspector: boolean;
  inspectionCompletedAtUtc: IsoDateTime;
  submittedAtUtc: IsoDateTime;
  decision: "APPROVE_REINSPECTION" | "REJECT" | null;
  decisionNotes: string | null;
  decidedAtUtc: IsoDateTime | null;
  authorizedReinspectionId: Guid | null;
  authorizedReinspectionNo: string | null;
  rowVersion: RowVersion;
}

export interface SellerInspectionDisputeDetailDto extends SellerInspectionDisputeDto {
  evidence: InspectionDisputeEvidenceDto[];
}

/** Seller-facing reason codes (the backend accepts any short code). */
export const DISPUTE_REASONS: Array<{ code: string; label: string }> = [
  { code: "GRADE_OR_RESULT", label: "Grade or inspection result is wrong" },
  { code: "CONDITION", label: "Condition was assessed incorrectly" },
  { code: "PRICE", label: "Proposed price is wrong" },
  { code: "QUANTITY", label: "Quantity count is wrong" },
  { code: "PROCESS", label: "Inspection wasn't done properly" },
  { code: "OTHER", label: "Something else" },
];
