/**
 * BD-ORDER-LIFECYCLE-01 contracts, copied from bidding-deal Emcore.BiddingDeal.Contracts/Orders/OrderLifecycleDtos.cs
 * (STOCKOUT main @ f7b3869). Seller fulfilment: SellerOrdersController (/api/v1/seller/orders/{subOrderId}/prepare |
 * ready-for-pickup | confirm-collection | claims | evidence, ?sellerId=). Buyer: BuyerOrdersController
 * (/api/v1/buyer/orders/{orderId}/suborders/{subOrderId}/accept | claims | evidence). No envelope; errors are ProblemDetails.
 * Status strings use the DB form (e.g. "READY_FOR_COLLECTION", "BUYER_PICKUP").
 */
type Guid = string;
type IsoDateTime = string;

export interface AcceptedLineQuantityDto {
  orderLineId: Guid;
  acceptedQuantity: number;
}

/** C#: BuyerAcceptSubOrderRequestDto. Omitting acceptedLines accepts every line in full. */
export interface BuyerAcceptSubOrderRequest {
  idempotencyKey?: string | null;
  expectedRowVersion?: string | null;
  notes?: string | null;
  acceptedLines?: AcceptedLineQuantityDto[] | null;
}

/** C#: OrderAcceptanceEventDto */
export interface OrderAcceptanceEventDto {
  acceptanceEventId: Guid;
  orderId: Guid;
  subOrderId: Guid;
  buyerUserId: Guid;
  sellerOrganizationId: Guid;
  /** e.g. ExplicitBuyerAcceptance, DeemedAcceptance */
  acceptanceType: string;
  acceptedAtUtc: IsoDateTime;
  actorId: string;
  evidenceReference: string | null;
  idempotencyKey: string;
  sourceEventId: Guid | null;
  createdAtUtc: IsoDateTime;
  payloadFingerprint: string | null;
  acceptedLines: AcceptedLineQuantityDto[];
}

/** C#: BuyerLodgeClaimRequestDto */
export interface BuyerLodgeClaimRequest {
  reason: string;
  affectedQuantity?: number | null;
  evidenceReference?: string | null;
  orderLineId?: Guid | null;
  expectedRowVersion?: string | null;
}

/** C#: BuyerOrderClaimDto */
export interface BuyerOrderClaimDto {
  claimId: Guid;
  subOrderId: Guid;
  orderId: Guid;
  buyerUserId: Guid;
  sellerOrganizationId: Guid;
  orderLineId: Guid | null;
  claimReason: string;
  affectedQuantity: number | null;
  evidenceReference: string | null;
  status: string;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  resolvedAtUtc: IsoDateTime | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
}

/** C#: UpdateFulfillmentStatusRequestDto (seller confirm-collection uses proofReference / remarks / expectedRowVersion). */
export interface UpdateFulfillmentStatusRequest {
  status?: string;
  proofReference?: string | null;
  remarks?: string | null;
  expectedRowVersion?: string | null;
  timestampUtc?: IsoDateTime | null;
}

/** C#: OrderDeliveryEvidenceDto */
export interface OrderDeliveryEvidenceDto {
  evidenceId: Guid;
  subOrderId: Guid;
  orderId: Guid;
  /** STOCKOUT_DELIVERY_PROOF | BUYER_PICKUP_PROOF | INSPECTION_CHECKLIST */
  evidenceType: string;
  fileAssetId: Guid | null;
  documentReference: string;
  recordedBy: string;
  recordedAtUtc: IsoDateTime;
  verificationStatus: string;
  verifiedBy: string | null;
  verifiedAtUtc: IsoDateTime | null;
  notes: string | null;
}
