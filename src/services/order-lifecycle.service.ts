import { http } from "@/lib/api/client";
import type { SellerSubOrderDto } from "@/api/types/orders";
import type { BuyerAcceptSubOrderRequest, BuyerLodgeClaimRequest, BuyerOrderClaimDto, OrderAcceptanceEventDto, OrderDeliveryEvidenceDto } from "@/api/types/order-lifecycle";

const seg = encodeURIComponent;
const ifMatch = (rowVersion?: string | null) => (rowVersion ? { "If-Match": `"${rowVersion}"` } : undefined);

/**
 * BD-ORDER-LIFECYCLE-01 (SellerOrdersController). Routes as in the source: /api/v1/seller/orders/{subOrderId}/…
 * (the 19 Nov handoff table says /seller/orders/suborders/{id}/…, which the controller does not map). The seller is
 * always the ?sellerId= query; If-Match carries the sub-order rowVersion. Each action returns the updated sub-order.
 */
export const sellerFulfilmentService = {
  prepare: (sellerId: string, subOrderId: string, rowVersion: string) =>
    http.post<SellerSubOrderDto>(`/api/v1/seller/orders/${seg(subOrderId)}/prepare`, undefined, { query: { sellerId }, headers: ifMatch(rowVersion) }),
  readyForPickup: (sellerId: string, subOrderId: string, rowVersion: string) =>
    http.post<SellerSubOrderDto>(`/api/v1/seller/orders/${seg(subOrderId)}/ready-for-pickup`, undefined, { query: { sellerId }, headers: ifMatch(rowVersion) }),
  confirmCollection: (sellerId: string, subOrderId: string, rowVersion: string, proofReference?: string, remarks?: string) =>
    http.post<SellerSubOrderDto>(
      `/api/v1/seller/orders/${seg(subOrderId)}/confirm-collection`,
      { status: "COLLECTED", proofReference: proofReference || null, remarks: remarks || null, expectedRowVersion: rowVersion },
      { query: { sellerId } },
    ),
  claims: (sellerId: string, subOrderId: string, signal?: AbortSignal) =>
    http.get<BuyerOrderClaimDto[]>(`/api/v1/seller/orders/${seg(subOrderId)}/claims`, { query: { sellerId }, signal }),
  evidence: (sellerId: string, subOrderId: string, signal?: AbortSignal) =>
    http.get<OrderDeliveryEvidenceDto[]>(`/api/v1/seller/orders/${seg(subOrderId)}/evidence`, { query: { sellerId }, signal }),
};

/**
 * Buyer acceptance and claims (BuyerOrdersController). Uses the nested /buyer/orders/{orderId}/suborders/{id}/… form:
 * the un-nested /buyer/suborders/… form has no gateway route yet (POST-DEPLOY-UAT-02 UAT-04).
 */
export const buyerAcceptanceService = {
  accept: (orderId: string, subOrderId: string, body: BuyerAcceptSubOrderRequest) =>
    http.post<OrderAcceptanceEventDto>(`/api/v1/buyer/orders/${seg(orderId)}/suborders/${seg(subOrderId)}/accept`, body),
  lodgeClaim: (orderId: string, subOrderId: string, body: BuyerLodgeClaimRequest) =>
    http.post<BuyerOrderClaimDto>(`/api/v1/buyer/orders/${seg(orderId)}/suborders/${seg(subOrderId)}/claims`, body),
  claims: (orderId: string, subOrderId: string, signal?: AbortSignal) =>
    http.get<BuyerOrderClaimDto[]>(`/api/v1/buyer/orders/${seg(orderId)}/suborders/${seg(subOrderId)}/claims`, { signal }),
  evidence: (orderId: string, subOrderId: string, signal?: AbortSignal) =>
    http.get<OrderDeliveryEvidenceDto[]>(`/api/v1/buyer/orders/${seg(orderId)}/suborders/${seg(subOrderId)}/evidence`, { signal }),
};

export const lifecycleKeys = {
  sellerClaims: (sellerId: string, id: string) => ["orders", "seller", sellerId, id, "claims"] as const,
  sellerEvidence: (sellerId: string, id: string) => ["orders", "seller", sellerId, id, "evidence"] as const,
  buyerClaims: (id: string) => ["orders", "buyer", "suborder", id, "claims"] as const,
  buyerEvidence: (id: string) => ["orders", "buyer", "suborder", id, "evidence"] as const,
};
