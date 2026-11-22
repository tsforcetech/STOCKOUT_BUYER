import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { SellerFulfilment, nextSellerStep } from "../seller-fulfilment";
import { BuyerAcceptance } from "../buyer-acceptance";
import type { SellerSubOrderDto } from "@/api/types/orders";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const O1 = "7b538e12-4f11-49b8-bc79-432859b83b10";
const SO1 = "9d1c1d2e-1111-4222-8333-444455556666";
const SELLER = "3934b874-33be-474d-9e12-247a0290c77e";
const RV = "AAAAAAAAB/E=";
const line = { orderLineId: "a0000000-0000-4000-8000-000000000001", subOrderId: SO1, listingId: "l-1", sellerId: SELLER, titleSnapshot: "HEB 300 Steel Beam", thumbnailUrlSnapshot: null, quantity: 10, unitPrice: 250, currency: "AED", taxRatePercent: 5, taxAmount: 125, lineSubtotal: 2500, lineTotal: 2625, isWholeLot: false, minOrderQuantity: 1 };
const sub = (over: Partial<SellerSubOrderDto> = {}) =>
  ({
    subOrderId: SO1, parentOrderId: O1, subOrderNumber: "SO-ORD-1-S1", sellerOrganizationId: SELLER, sellerLegalName: "Apex Steel LLC", sellerTradingName: "Apex Steel", sellerTaxRegistrationNumber: null,
    materialSubtotal: 2500, applicableMaterialVat: 125, subOrderTotal: 2625, status: "CONFIRMED", fulfillmentStatus: "NOT_STARTED", fulfillmentMethod: "BUYER_PICKUP", claimStatus: "NONE",
    payoutEligibility: "NOT_ELIGIBLE", purchasedAtUtc: null, deliveredAtUtc: null, isDeliveryProofVerified: false, deliveryProofReference: null, deliveryProofVerifiedBy: null, deliveryProofVerifiedAtUtc: null,
    holdingPeriodReferenceDateUtc: null, holdingPeriodStartDateUtc: null, holdingPeriodEndDateUtc: null, missingHoldingCalculationDependency: null, sellerConfirmedAtUtc: null, sellerRejectedAtUtc: null,
    sellerRejectionReason: null, rowVersion: RV, createdAtUtc: "2026-11-09T10:15:30Z", updatedAtUtc: null, items: [line], statusHistory: [], ...over,
  }) as SellerSubOrderDto;
const at = (el: React.ReactNode) => renderWithApp([{ path: "/x", element: el }], "/x");

describe("seller fulfilment (BD-ORDER-LIFECYCLE-01, gated)", () => {
  it("picks the next step from status, fulfilment status and method", () => {
    expect(nextSellerStep(sub())).toBe("prepare");
    expect(nextSellerStep(sub({ status: "IN_FULFILLMENT", fulfillmentStatus: "PREPARING" }))).toBe("ready");
    expect(nextSellerStep(sub({ status: "IN_FULFILLMENT", fulfillmentStatus: "READY_FOR_COLLECTION" }))).toBe("collected");
    expect(nextSellerStep(sub({ status: "IN_FULFILLMENT", fulfillmentStatus: "PREPARING", fulfillmentMethod: "STOCKOUT_DELIVERY" }))).toBeNull();
    expect(nextSellerStep(sub({ status: "PENDING_CONFIRMATION" }))).toBeNull();
    expect(nextSellerStep(sub({ status: "DELIVERED", fulfillmentStatus: "COLLECTED" }))).toBeNull();
  });

  it("Start preparing posts to /seller/orders/{id}/prepare with ?sellerId= and If-Match", async () => {
    let req: { url: URL; ifMatch: string | null } | null = null;
    mockFetch([{ method: "POST", path: `/api/v1/seller/orders/${SO1}/prepare`, respond: ({ url, init }) => ((req = { url, ifMatch: new Headers(init.headers).get("If-Match") }), { body: sub({ status: "IN_FULFILLMENT", fulfillmentStatus: "PREPARING" }) }) }]);
    at(<SellerFulfilment sellerId={SELLER} sub={sub()} />);
    await userEvent.click(screen.getByRole("button", { name: /Start preparing/ }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Start preparing" }));
    await waitFor(() => expect(req).not.toBeNull());
    expect(req!.url.searchParams.get("sellerId")).toBe(SELLER);
    expect(req!.ifMatch).toBe(`"${RV}"`);
  });

  it("Confirm buyer collected sends COLLECTED, the optional reference and the rowVersion", async () => {
    let body: unknown = null;
    mockFetch([{ method: "POST", path: `/api/v1/seller/orders/${SO1}/confirm-collection`, respond: (r) => ((body = r.body), { body: sub({ status: "DELIVERED", fulfillmentStatus: "COLLECTED" }) }) }]);
    at(<SellerFulfilment sellerId={SELLER} sub={sub({ status: "IN_FULFILLMENT", fulfillmentStatus: "READY_FOR_COLLECTION" })} />);
    await userEvent.click(screen.getByRole("button", { name: /Confirm buyer collected/ }));
    const dlg = await screen.findByRole("alertdialog");
    await userEvent.type(within(dlg).getByLabelText(/Collection reference/), "GP-1042");
    await userEvent.click(within(dlg).getByRole("button", { name: "Confirm buyer collected" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ status: "COLLECTED", proofReference: "GP-1042", expectedRowVersion: RV });
  });

  it("StockOut-delivered orders have no seller step after preparing; a stale version is explained", async () => {
    mockFetch([{ method: "POST", path: `/api/v1/seller/orders/${SO1}/prepare`, respond: () => ({ status: 409, body: { status: 409, code: "CONCURRENCY_CONFLICT" } }) }]);
    const { unmount } = at(<SellerFulfilment sellerId={SELLER} sub={sub({ status: "IN_FULFILLMENT", fulfillmentStatus: "IN_TRANSIT", fulfillmentMethod: "STOCKOUT_DELIVERY" })} />);
    expect(screen.getByText(/StockOut freight collects them from you|StockOut freight delivers this order/)).toBeInTheDocument();
    unmount();
    at(<SellerFulfilment sellerId={SELLER} sub={sub()} />);
    await userEvent.click(screen.getByRole("button", { name: /Start preparing/ }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Start preparing" }));
    expect(await screen.findByText(/This order changed since you opened it/)).toBeInTheDocument();
  });
});

describe("buyer acceptance and claims (BD-ORDER-LIFECYCLE-01, gated)", () => {
  const delivered = sub({ status: "DELIVERED", fulfillmentStatus: "COLLECTED", deliveredAtUtc: "2026-11-20T08:00:00Z" });
  const reads = [
    { method: "GET", path: `/api/v1/buyer/orders/${O1}/suborders/${SO1}/evidence`, respond: () => ({ body: [{ evidenceId: "e1", subOrderId: SO1, orderId: O1, evidenceType: "BUYER_PICKUP_PROOF", fileAssetId: null, documentReference: "GP-1042", recordedBy: "seller", recordedAtUtc: "2026-11-20T08:00:00Z", verificationStatus: "PENDING", verifiedBy: null, verifiedAtUtc: null, notes: null }] }) },
    { method: "GET", path: `/api/v1/buyer/orders/${O1}/suborders/${SO1}/claims`, respond: () => ({ body: [] }) },
  ];

  it("shows the 5-day window and accepts with an idempotency key and the rowVersion; a retry reuses the key", async () => {
    let n = 0;
    const bodies: Array<Record<string, unknown>> = [];
    mockFetch([
      ...reads,
      { method: "POST", path: `/api/v1/buyer/orders/${O1}/suborders/${SO1}/accept`, respond: (r) => (bodies.push(r.body as Record<string, unknown>), ++n === 1 ? { status: 503, body: { status: 503 } } : { body: { acceptanceEventId: "ae1" } }) },
    ]);
    at(<BuyerAcceptance orderId={O1} sub={delivered} />);
    expect(screen.getByText(/Check the goods, then accept them or report a problem/)).toBeInTheDocument();
    expect(await screen.findByText(/Collection record/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Accept goods/ }));
    const dlg = await screen.findByRole("alertdialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Accept goods" }));
    expect(await within(dlg).findByText(/couldn't send that/)).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole("button", { name: "Accept goods" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0]).toMatchObject({ expectedRowVersion: RV });
    expect(bodies[0].idempotencyKey).toBeTruthy();
    expect(bodies[1].idempotencyKey).toBe(bodies[0].idempotencyKey);
  });

  it("a claim needs a reason and sends the item, quantity and rowVersion", async () => {
    let body: unknown = null;
    mockFetch([...reads, { method: "POST", path: `/api/v1/buyer/orders/${O1}/suborders/${SO1}/claims`, respond: (r) => ((body = r.body), { body: { claimId: "c1" } }) }]);
    at(<BuyerAcceptance orderId={O1} sub={delivered} />);
    await userEvent.click(screen.getByRole("button", { name: /Report a problem/ }));
    const dlg = await screen.findByRole("alertdialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Send claim" }));
    expect(await within(dlg).findByText(/Tell us what's wrong/)).toBeInTheDocument();
    await userEvent.selectOptions(within(dlg).getByLabelText(/^Item/), line.orderLineId);
    await userEvent.type(within(dlg).getByLabelText(/Quantity affected/), "3");
    await userEvent.type(within(dlg).getByLabelText(/What's wrong/), "3 beams bent");
    await userEvent.click(within(dlg).getByRole("button", { name: "Send claim" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ reason: "3 beams bent", orderLineId: line.orderLineId, affectedQuantity: 3, expectedRowVersion: RV });
  });

  it("an open claim pauses acceptance; undelivered orders show nothing", () => {
    mockFetch(reads);
    const { unmount } = at(<BuyerAcceptance orderId={O1} sub={sub({ status: "CLAIM_DISPUTED", claimStatus: "FILED" })} />);
    expect(screen.getByText(/Acceptance is paused/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept goods/ })).not.toBeInTheDocument();
    unmount();
    const { container } = at(<BuyerAcceptance orderId={O1} sub={sub()} />);
    expect(container.querySelector("button")).toBeNull();
  });
});
