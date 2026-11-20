/**
 * COM-ORD-01 order placement (bidding-deal Contracts/Orders/OrderPlacementContracts.cs, CheckoutDeliveryContracts.cs;
 * handoff 20 Nov 2026 §4.3). Buyer identity comes from the JWT; prices, tax, addresses and sellers are derived by
 * the server from the authorisation snapshot, never from the browser.
 */
type Guid = string;
type Utc = string;

/** C# FulfillmentDeliveryMode. Only SELF_COLLECTION is offered until delivery fee / VAT policy is approved. */
export type DeliveryMode = "SELF_COLLECTION" | "SELLER_DELIVERY" | "PLATFORM_ARRANGED_DELIVERY";

export interface SellerSubOrderDeliverySelection {
  sellerId: Guid;
  sellerOrganizationId: Guid | null;
  deliveryMode: DeliveryMode;
  shippingOptionCode: string | null;
  /** Not supported in this phase (server rejects overrides). */
  overrideDeliveryAddressId: null;
  buyerDeliveryInstructions: string | null;
}

/** Headers: Idempotency-Key (8..100 of A-Z a-z 0-9 _ . -), If-Match: "<Base64 8-byte cart rowVersion>". */
export interface PlaceBuyerOrderRequest {
  paymentAuthorizationAttemptId: Guid;
  cartId: Guid;
  purchasingOrganizationId: Guid | null;
  /** Required only when a selection needs a delivery address; null for collection. */
  deliveryAddressId: Guid | null;
  /** Must equal the authorised amount exactly. */
  expectedPayableTotal: number;
  currency: "AED";
  sellerSelections: SellerSubOrderDeliverySelection[];
}

export interface PlacedSellerSubOrderDto {
  subOrderId: Guid;
  subOrderNumber: string;
  sellerOrganizationId: Guid;
  status: string;
  materialSubtotal: number;
  materialVat: number;
  subOrderTotal: number;
  confirmationDeadlineUtc: Utc | null;
  deliveryMode: string | null;
  deliveryFeeSubtotal: number;
  deliveryVatAmount: number;
}

export interface PlaceBuyerOrderResponse {
  /** True ONLY after the server's transaction committed. */
  orderPlaced: boolean;
  checkoutStage: string;
  isIdempotentReplay: boolean;
  orderId: Guid;
  paymentAuthorizationAttemptId: Guid;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  currency: string;
  materialSubtotal: number;
  materialVat: number;
  deliveryAmount: number;
  deliveryVatAmount: number;
  totalPayableAmount: number;
  createdAtUtc: Utc;
  sellerSubOrders: PlacedSellerSubOrderDto[];
}
