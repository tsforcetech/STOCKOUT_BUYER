import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { BuyerOrderDetail } from "../components/order-views";
import { canCancelOrder, canCancelPart, canChangeAddress } from "../buyer-order-actions";
import type { MarketplaceOrderDto, SellerSubOrderDto } from "@/api/types/orders";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const O1 = "7b538e12-4f11-49b8-bc79-432859b83b10";
const S1 = "9d1c1d2e-1111-4222-8333-444455556661";
const S2 = "9d1c1d2e-1111-4222-8333-444455556662";
const ORG = "3934b874-33be-474d-9e12-247a0290c77e";
const ORV = "AAAAAAAAC/8=";
const line = (sub: string) => ({ orderLineId: `l-${sub}`, subOrderId: sub, listingId: "l-1", sellerId: "s", titleSnapshot: "PPR Flange Adaptor", thumbnailUrlSnapshot: null, quantity: 1, unitPrice: 100, currency: "AED", taxRatePercent: 5, taxAmount: 5, lineSubtotal: 100, lineTotal: 105, isWholeLot: false, minOrderQuantity: 1 });
const sub = (id: string, name: string, rv: string, over: Partial<SellerSubOrderDto> = {}) =>
  ({
    subOrderId: id, parentOrderId: O1, subOrderNumber: `SO-10000009-${name}`, sellerOrganizationId: "s", sellerLegalName: `${name} LLC`, sellerTradingName: name, sellerTaxRegistrationNumber: null,
    materialSubtotal: 100, applicableMaterialVat: 5, subOrderTotal: 105, status: "CONFIRMED", fulfillmentStatus: "NOT_STARTED", fulfillmentMethod: "STOCKOUT_DELIVERY", claimStatus: "NONE",
    payoutEligibility: "NOT_ELIGIBLE", purchasedAtUtc: null, deliveredAtUtc: null, isDeliveryProofVerified: false, deliveryProofReference: null, deliveryProofVerifiedBy: null, deliveryProofVerifiedAtUtc: null,
    holdingPeriodReferenceDateUtc: null, holdingPeriodStartDateUtc: null, holdingPeriodEndDateUtc: null, missingHoldingCalculationDependency: null, sellerConfirmedAtUtc: null, sellerRejectedAtUtc: null,
    sellerRejectionReason: null, rowVersion: rv, createdAtUtc: "2026-11-27T10:00:00Z", updatedAtUtc: null, items: [line(id)], statusHistory: [], ...over,
  }) as SellerSubOrderDto;
const snapshot = JSON.stringify({ sourceAddressId: "addr-1", label: "Site A", contactName: "Hakeem", contactPhone: "0501234567", building: "Tower 1", street: "Al Rasheed St", area: "Deira", city: "Dubai", stateOrEmirate: "Dubai" });
const order = (over: Partial<MarketplaceOrderDto> = {}): MarketplaceOrderDto => ({
  orderId: O1, orderNumber: "SO-10000009", buyerUserId: "u", buyerOrganizationId: ORG, orderDateUtc: "2026-11-27T10:00:00Z", currency: "AED", aggregateMaterialAmount: 200, applicableMaterialVat: 10,
  deliveryAmount: 9.52, deliveryVatAmount: 0.48, deliveryAddressSnapshotJson: snapshot, totalPayableAmount: 220, status: "PENDING_CONFIRMATION", paymentStatus: "AUTHORIZED", paymentReference: "pi_1",
  lifecycleVersion: 1, rowVersion: ORV, createdAtUtc: "2026-11-27T10:00:00Z", updatedAtUtc: null, subOrders: [sub(S1, "Apex", "AAAAAAAAC/s="), sub(S2, "Emcore", "AAAAAAAAC/t=")], statusHistory: [], ...over,
});
const at = (o: MarketplaceOrderDto) => renderWithApp([{ path: "/x", element: <BuyerOrderDetail order={o} /> }], "/x");

describe("buyer order changes before dispatch (OJ-04 / OJ-05)", () => {
  it("offers cancel and address change only before anything is dispatched", () => {
    const o = order();
    expect([canCancelOrder(o), canChangeAddress(o), canCancelPart(o, o.subOrders[0])]).toEqual([true, true, true]);
    const shipped = order({ subOrders: [sub(S1, "Apex", "x", { status: "IN_FULFILLMENT", fulfillmentStatus: "IN_TRANSIT" }), sub(S2, "Emcore", "y")] });
    expect([canCancelOrder(shipped), canChangeAddress(shipped), canCancelPart(shipped, shipped.subOrders[1])]).toEqual([false, false, true]);
    const single = order({ subOrders: [sub(S1, "Apex", "x")] });
    expect(canCancelPart(single, single.subOrders[0])).toBe(false); // the whole-order cancel covers it
    expect(canCancelOrder(order({ status: "COMPLETED" }))).toBe(false);
  });

  it("cancels the whole order with a reason, the order version and one idempotency key; says nothing was charged", async () => {
    const posts: Array<Record<string, unknown>> = [];
    mockFetch([{ method: "POST", path: `/api/v1/buyer/orders/${O1}/cancel`, respond: (r) => (posts.push(r.body as Record<string, unknown>), { body: { cancelled: true, code: "CANCELLATION_SUCCESSFUL", message: "ok", order: order({ status: "CANCELLED" }) } }) }]);
    at(order());
    expect(screen.getByText("Delivering to")).toBeInTheDocument();
    expect(screen.getByText("Tower 1, Al Rasheed St")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText(/Nothing was charged/)).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole("combobox", { name: /Why are you cancelling/ }));
    await userEvent.click(await screen.findByRole("option", { name: "I ordered by mistake" }));
    await userEvent.click(within(dlg).getByRole("button", { name: "Cancel order" }));
    expect(await screen.findByText(/Order cancelled\./)).toBeInTheDocument();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ reason: "I ordered by mistake", expectedRowVersion: ORV });
    expect(String(posts[0].idempotencyKey)).toMatch(/^buyer_cancel_/);
  });

  it("cancels one seller's part with that part's own version; a refusal is explained, not retried", async () => {
    const posts: Array<Record<string, unknown>> = [];
    mockFetch([
      {
        method: "POST",
        path: `/api/v1/buyer/orders/${O1}/suborders/${S2}/cancel`,
        respond: (r) => (posts.push(r.body as Record<string, unknown>), { status: 409, body: { status: 409, code: "CANCELLATION_BLOCKED", detail: "SUB_ORDER_DISPATCHED_OR_TERMINAL: already IN_TRANSIT" } }),
      },
    ]);
    at(order());
    const emcore = screen.getByRole("region", { name: "From Emcore" });
    await userEvent.click(within(emcore).getByRole("button", { name: /Cancel these items/ }));
    const dlg = await screen.findByRole("alertdialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Cancel these items" }));
    expect(await within(dlg).findByText(/already on its way/)).toBeInTheDocument();
    expect(posts).toHaveLength(1);
    expect(posts[0].expectedRowVersion).toBe("AAAAAAAAC/t=");
  });

  it("changes the address with If-Match = order version, skipping the current address", async () => {
    let req: { body: unknown; ifMatch: string | null } | null = null;
    const addr = (id: string, label: string) => ({ addressId: id, ownerOrganizationId: ORG, label, contactName: "H", contactPhone: "05", siteName: null, siteContactName: null, siteContactPhone: null, countryCode: "ARE", stateOrEmirate: "Dubai", city: "Dubai", area: "Jebel Ali", street: null, building: null, unit: null, postalCode: null, deliveryNotes: null, latitude: 25, longitude: 55, mapPlaceId: null, mapFormattedAddress: null, isDefault: false, status: "ACTIVE", rowVersion: "r" });
    mockFetch([
      { method: "GET", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses`, respond: () => ({ body: { success: true, data: { items: [addr("addr-1", "Site A"), addr("addr-2", "Warehouse B")], page: 1, pageSize: 20, totalCount: 2 } } }) },
      { method: "PATCH", path: `/api/v1/buyer/orders/${O1}/delivery-address`, respond: ({ body, init }) => ((req = { body, ifMatch: new Headers(init.headers).get("If-Match") }), { body: { code: "ADDRESS_AMENDED", message: "Delivery address updated." } }) },
    ]);
    at(order());
    await userEvent.click(screen.getByRole("button", { name: /Change/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(await within(dlg).findByText("Warehouse B")).toBeInTheDocument();
    expect(within(dlg).queryByText("Site A")).not.toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole("button", { name: "Change address" }));
    expect(await screen.findByText("Delivery address updated.")).toBeInTheDocument();
    expect(req!.ifMatch).toBe(`"${ORV}"`);
    expect(req!.body).toMatchObject({ savedAddressId: "addr-2", expectedRowVersion: ORV });
  });

  it("shows a seller-rejection money update as a proposal, not a refund", () => {
    at(
      order({
        reconciliationSummary: {
          reconciliationId: "r", revision: 1, reconciliationStatus: "SELLER_REJECTION_RECEIVED", totalSubOrdersCount: 2, activeSubOrdersCount: 1, rejectedSubOrdersCount: 1, currency: "AED",
          originalOrderPayableAmount: 220, retainedDeliveryGrossAmount: 10, proposedRefundableDeliveryGrossAmount: 0, proposedRejectedMaterialAmount: 105, proposedTotalAdjustmentAmount: 105,
          activeOrderRemainingPayableAmount: 115, requiresFinanceRiskApproval: true, isFinancialExecutionBlocked: true, requiresTaxCreditNote: true, safeExplanationMessage: "One seller rejected their items.", evaluatedAtUtc: "2026-11-27T11:00:00Z",
        },
      }),
    );
    const box = screen.getByRole("region", { name: "Order total update" });
    expect(within(box).getByText("One seller rejected their items.")).toBeInTheDocument();
    expect(within(box).getByText("AED 115.00")).toBeInTheDocument();
    expect(within(box).getByText(/StockOut checks this before anything changes on your card/)).toBeInTheDocument();
    expect(within(box).queryByText(/refunded/i)).not.toBeInTheDocument();
  });
});
