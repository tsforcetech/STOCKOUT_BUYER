import { http } from "@/lib/api/client";
import type { MarketplaceOrderDto, OrderReconciliationSummaryDto } from "@/api/types/orders";

/**
 * Buyer order changes before dispatch (BuyerOrdersController, OJ-04 / OJ-05, live 27 Nov 2026). Each call carries the
 * version the buyer was looking at (the order's for a whole-order cancel or an address change, the seller part's for a
 * part cancel) and one idempotency key per attempt, so a retry never cancels or changes twice.
 */
const seg = encodeURIComponent;
const base = (orderId: string) => `/api/v1/buyer/orders/${seg(orderId)}`;

export interface BuyerCancelResponse {
  orderId: string;
  orderNumber: string;
  cancelled: boolean;
  isIdempotentReplay: boolean;
  cancellationStatus: string;
  inventoryCompensationStatus: string;
  financialReconciliationStatus: string;
  paymentExecutionStatus: string;
  code: string;
  message: string;
  order: MarketplaceOrderDto;
  reconciliationSummary?: OrderReconciliationSummaryDto | null;
}

export interface BuyerAddressAmendmentResponse {
  orderId: string;
  amendmentReference: string;
  amendmentStatus: string;
  code: string;
  message: string;
  order?: MarketplaceOrderDto | null;
}

interface CancelBody {
  reason: string;
  remarks?: string | null;
  idempotencyKey: string;
  expectedRowVersion: string;
}

export const buyerOrderActions = {
  cancelOrder: (orderId: string, body: CancelBody) => http.post<BuyerCancelResponse>(`${base(orderId)}/cancel`, body),
  cancelSubOrder: (orderId: string, subOrderId: string, body: CancelBody) => http.post<BuyerCancelResponse>(`${base(orderId)}/suborders/${seg(subOrderId)}/cancel`, body),
  /** The address change wants the order version in If-Match (the body field alone is not read first). */
  changeAddress: (orderId: string, body: { savedAddressId: string; reason: string; idempotencyKey: string; expectedRowVersion: string }) =>
    http.patch<BuyerAddressAmendmentResponse>(`${base(orderId)}/delivery-address`, body, { headers: { "If-Match": `"${body.expectedRowVersion}"`, "Idempotency-Key": body.idempotencyKey } }),
};
