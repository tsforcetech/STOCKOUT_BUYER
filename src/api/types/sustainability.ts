/**
 * SUS-03 transaction sustainability reports, copied from bidding-deal
 * Emcore.BiddingDeal.Contracts/Sustainability/TransactionSustainabilityDtos.cs (STOCKOUT main @ f7b3869).
 * Values come from frozen accepted-order snapshots; the browser never computes or edits them. No envelope.
 */
type Guid = string;
type IsoDateTime = string;

/** EvidenceBackedEstimate | UnverifiedModelEstimate (never "certified" or "audited"). */
export type VerificationLevel = "EvidenceBackedEstimate" | "UnverifiedModelEstimate" | (string & {});

/** C#: TransactionImpactSnapshotDto (fields the UI reads; the rest are kept for completeness). */
export interface TransactionImpactSnapshotDto {
  snapshotId: Guid;
  orderId: Guid;
  subOrderId: Guid | null;
  orderLineId: Guid;
  listingId: Guid;
  listingVersionId: Guid;
  acceptanceType: string;
  acceptedAtUtc: IsoDateTime;
  factorCodeApplied: string;
  factorVersionApplied: string;
  materialCode: string;
  materialName: string;
  materialCategory: string;
  quantity: number;
  quantityUnit: string;
  totalWeightKg: number;
  materialImpactKgCo2e: number;
  netModeledAvoidedEmissionsKgCo2e: number | null;
  /** Never shown: illustrative only. */
  illustrativeGreenPoints?: number | null;
  /** null until Green Points earning is approved; never replaced by 0 or an estimate. */
  approvedEarnablePoints: number | null;
  /** "BlockedPolicyApprovalMissing" today */
  pointsStatus: string;
  passengerCarKmEquivalent: number | null;
  verificationLevel: VerificationLevel;
  methodologyVersionCode?: string;
}

/** C#: TransactionImpactAdjustmentDto */
export interface TransactionImpactAdjustmentDto {
  adjustmentId: Guid;
  snapshotId: Guid;
  orderLineId: Guid;
  adjustmentType: string;
  adjustmentReason: string;
  originalQuantity: number;
  adjustedQuantity: number;
  effectiveQuantity: number;
  reversedMaterialImpactKgCo2e: number;
  effectiveMaterialImpactKgCo2e: number;
  reversedNetAvoidedEmissionsKgCo2e: number | null;
  effectiveNetAvoidedEmissionsKgCo2e: number | null;
  isPhysicalReturn: boolean;
  claimReference: string | null;
  createdAtUtc: IsoDateTime;
}

/** C#: TransactionSustainabilityReportDto */
export interface TransactionSustainabilityReportDto {
  reportId: Guid;
  reportNumber: string;
  orderId: Guid;
  subOrderId: Guid | null;
  buyerUserId: Guid;
  buyerOrganizationId: Guid | null;
  sellerOrganizationId: Guid;
  reportType: string;
  reportStatus: string;
  totalPhysicalMassKg: number;
  totalEmbodiedCarbonKgCo2e: number;
  totalNetAvoidedCarbonKgCo2e: number | null;
  reportRevision: number;
  supersededByReportId: Guid | null;
  fileAssetId: Guid | null;
  downloadUrl: string | null;
  generatedAtUtc: IsoDateTime;
  createdAtUtc: IsoDateTime;
  lineSnapshots: TransactionImpactSnapshotDto[];
  adjustments: TransactionImpactAdjustmentDto[];
  /** Shown verbatim under the metrics. */
  environmentalDisclaimer: string;
}
