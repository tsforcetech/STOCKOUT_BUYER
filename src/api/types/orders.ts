/**
 * Stage 8C marketplace order contracts, copied from the C# source (bidding-deal, commit ee144bd):
 *   Emcore.BiddingDeal.Contracts/Orders/OrderDtos.cs and CheckoutValidationDtos.cs.
 * Read-only routes (API gateway): GET /api/v1/buyer/checkout/readiness, /buyer/orders, /buyer/orders/{orderId},
 * /seller/orders, /seller/orders/{subOrderId}. Responses have no envelope; errors are ProblemDetails with `code`.
 * Status strings arrive upper-cased without separators (e.g. "PENDINGCONFIRMATION"); see order-status.ts.
 */

import type { CheckoutBlockerDto } from "./buyer-commerce";

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
  rowVersion: string;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  items: OrderLineSnapshotDto[];
  statusHistory: OrderStatusHistoryDto[];
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
  statusHistory: OrderStatusHistoryDto[];
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

/** C#: Contracts.Orders.OrderLinePreviewDto (checkout readiness line) */
export interface OrderLinePreviewDto {
  listingId: Guid;
  sellerId: Guid;
  title: string;
  thumbnailUrl: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  taxRatePercent: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  isPurchasable: boolean;
  blockerCode: string | null;
  blockerMessage: string | null;
}

/** C#: Contracts.Orders.SellerSubOrderPreviewDto */
export interface SellerSubOrderPreviewDto {
  sellerId: Guid;
  sellerDisplayName: string | null;
  groupSubtotal: number;
  groupVatAmount: number;
  groupTotal: number;
  lines: OrderLinePreviewDto[];
}

/** C#: Contracts.Orders.CheckoutValidationResult (GET /api/v1/buyer/checkout/readiness). Informational only: no order is created. */
export interface CheckoutValidationResult {
  canProceed: boolean;
  cartId: Guid;
  buyerUserId: Guid;
  buyerProfileId: Guid | null;
  buyerOrganizationId: Guid | null;
  currency: string;
  totalDistinctItems: number;
  totalQuantity: number;
  totalMaterialSubtotal: number;
  applicableVatRatePercent: number;
  estimatedVatAmount: number;
  estimatedPayableTotal: number;
  sellerSubOrders: SellerSubOrderPreviewDto[];
  blockers: CheckoutBlockerDto[];
  /** base64 8-byte cart rowversion */
  cartRowVersion: string;
}
