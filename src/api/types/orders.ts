/**
 * Stage 8B.3 marketplace order contracts, copied from the C# source (bidding-deal, commit 689d3f8):
 *   Emcore.BiddingDeal.Contracts/Orders/OrderDtos.cs and Domain/Orders/MarketplaceOrderStatus.cs.
 *
 * IMPORTANT: no controller exposes these yet. GET /api/v1/orders, /orders/{id}, /seller/orders,
 * /seller/orders/{id} and /orders/{id}/history are "PROPOSED FUTURE" in the 8B.3 handoff and return
 * 404 unmatched_gateway_route on the live gateway (checked 5 Nov 2026). Nothing in the app calls them;
 * see src/lib/orders/order-api.ts. Enum values are serialized as names (the handoff samples show "Draft").
 */

type Guid = string;
/** DateTimeOffset, ISO 8601 */
type IsoDateTime = string;

/** C#: Domain.Orders.MarketplaceOrderStatus */
export type MarketplaceOrderStatus = "Draft" | "PendingConfirmation" | "Confirmed" | "InFulfillment" | "Completed" | "Cancelled";
/** C#: Domain.Orders.SellerSubOrderStatus */
export type SellerSubOrderStatus = "PendingConfirmation" | "Confirmed" | "Rejected" | "Expired" | "InFulfillment" | "Delivered" | "Accepted" | "ClaimDisputed" | "Cancelled";
/** C#: Domain.Orders.OrderPaymentStatus */
export type OrderPaymentStatus = "PendingAuthorization" | "Authorized" | "CapturePending" | "Captured" | "AuthorizationExpired" | "Voided" | "RefundPending" | "Refunded" | "Failed";
/** C#: Domain.Orders.FulfillmentLifecycleStatus */
export type FulfillmentLifecycleStatus = "NotStarted" | "Preparing" | "ReadyForCollection" | "InTransit" | "Delivered" | "Collected";
/** C#: Domain.Orders.ClaimDisputeLifecycleStatus */
export type ClaimDisputeLifecycleStatus = "None" | "Filed" | "UnderReview" | "Approved" | "Rejected" | "Escalated";
/** C#: Domain.Orders.SellerPayoutEligibilityStatus */
export type SellerPayoutEligibilityStatus = "NotEligible" | "HoldingPeriodPendingProof" | "HoldingPeriodActive" | "EligibleForSettlement" | "HoldPendingDispute" | "Settled";

/** C#: Contracts.Orders.OrderLineSnapshotDto */
export interface OrderLineSnapshotDto {
  orderLineId: Guid;
  subOrderId: Guid;
  listingId: Guid;
  sellerId: Guid;
  titleSnapshot: string;
  thumbnailUrlSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  taxRatePercent: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  isWholeLot: boolean;
  minOrderQuantity: number | null;
}

/** C#: Contracts.Orders.SellerSubOrderDto (the seller's own view of one suborder) */
export interface SellerSubOrderDto {
  subOrderId: Guid;
  parentOrderId: Guid;
  subOrderNumber: string;
  sellerOrganizationId: Guid;
  sellerLegalName: string | null;
  sellerTradingName: string | null;
  sellerTaxRegistrationNumber: string | null;
  materialSubtotal: number;
  applicableMaterialVat: number;
  subOrderTotal: number;
  status: SellerSubOrderStatus | string;
  fulfillmentStatus: FulfillmentLifecycleStatus | string;
  claimStatus: ClaimDisputeLifecycleStatus | string;
  payoutEligibility: SellerPayoutEligibilityStatus | string;
  purchasedAtUtc: IsoDateTime | null;
  deliveredAtUtc: IsoDateTime | null;
  isDeliveryProofVerified: boolean;
  deliveryProofReference: string | null;
  deliveryProofVerifiedBy: string | null;
  deliveryProofVerifiedAtUtc: IsoDateTime | null;
  holdingPeriodReferenceDateUtc: IsoDateTime | null;
  holdingPeriodStartDateUtc: IsoDateTime | null;
  holdingPeriodEndDateUtc: IsoDateTime | null;
  missingHoldingCalculationDependency: string | null;
  sellerConfirmedAtUtc: IsoDateTime | null;
  sellerRejectedAtUtc: IsoDateTime | null;
  sellerRejectionReason: string | null;
  items: OrderLineSnapshotDto[];
}

/** C#: Contracts.Orders.MarketplaceOrderDto (buyer's parent order with every seller suborder) */
export interface MarketplaceOrderDto {
  orderId: Guid;
  orderNumber: string;
  buyerUserId: Guid;
  buyerOrganizationId: Guid | null;
  orderDateUtc: IsoDateTime;
  currency: string;
  aggregateMaterialAmount: number;
  applicableMaterialVat: number;
  deliveryAmount: number;
  deliveryVatAmount: number;
  totalPayableAmount: number;
  status: MarketplaceOrderStatus | string;
  paymentStatus: OrderPaymentStatus | string;
  paymentReference: string | null;
  lifecycleVersion: number;
  /** base64 8-byte rowversion; send back quoted in If-Match once order mutations exist. */
  rowVersion: string;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  subOrders: SellerSubOrderDto[];
}

/** C#: Contracts.Orders.OrderStatusHistoryDto */
export interface OrderStatusHistoryDto {
  historyId: Guid;
  orderId: Guid;
  subOrderId: Guid | null;
  entityType: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  reasonOrNote: string | null;
  changedAtUtc: IsoDateTime;
}

/**
 * PROPOSED ONLY (8B.3 handoff §3.1 sample). There is no C# list DTO yet, so this mirrors the sample and must be
 * re-checked against the real controller before use.
 */
export interface ProposedOrderSummary {
  orderId: Guid;
  orderNumber: string;
  orderDateUtc: IsoDateTime;
  currency: string;
  totalPayableAmount: number;
  status: MarketplaceOrderStatus | string;
  paymentStatus: OrderPaymentStatus | string;
  subOrderCount: number;
  createdAtUtc: IsoDateTime;
}
