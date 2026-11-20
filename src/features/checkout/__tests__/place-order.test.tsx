import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { PlaceOrder } from "../place-order";
import { canPlaceOrder, collectionSelections, hasPlacedOrder } from "@/lib/orders/order-placement";
import type { PaymentAuthorizationStatusResponse } from "@/api/types/payment-preauth";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const CART = "c1000000-0000-4000-8000-000000000001";
const ORG = "3934b874-33be-474d-9e12-247a0290c77e";
const ATTEMPT = "a1000000-0000-4000-8000-0000000000aa";
const ORDER = "0d000000-0000-4000-8000-0000000000dd";
const S1 = "51000000-0000-4000-8000-000000000001";
const S2 = "52000000-0000-4000-8000-000000000002";
const RV = "AAAAAAAAB9Q=";
const res = (sellerId: string, sellerOrganizationId: string | null) => ({ reservationId: `r-${sellerId}-${Math.random()}`, listingId: "l", sellerId, sellerOrganizationId, quantity: 1, unitPrice: 500, lineSubtotal: 500, lineVat: 25, lineTotal: 525, currency: "AED", reservationStatus: "HELD_POST_AUTH", expiresAtUtc: "2026-11-25T10:00:00Z", postAuthHeldAtUtc: null });
const status = (over: Partial<PaymentAuthorizationStatusResponse> = {}) =>
  ({
    attemptId: ATTEMPT, cartId: CART, buyerOrganizationId: ORG, internalStatus: "AUTHORIZED", isProviderVerified: true, checkoutStage: "INVENTORY_PROTECTED", orderPlaced: false, orderId: null, orderNumber: null,
    authorizedAmount: 1050, currency: "AED", reservations: [res(S1, S1), res(S1, S1), res(S2, null)], ...over,
  }) as PaymentAuthorizationStatusResponse;
const placed = { orderPlaced: true, checkoutStage: "SELLER_CONFIRMATION_PENDING", isIdempotentReplay: false, orderId: ORDER, paymentAuthorizationAttemptId: ATTEMPT, orderNumber: "SO-2026-000123", orderStatus: "PendingConfirmation", paymentStatus: "AUTHORIZED", currency: "AED", materialSubtotal: 1000, materialVat: 50, deliveryAmount: 0, deliveryVatAmount: 0, totalPayableAmount: 1050, createdAtUtc: "2026-11-20T10:00:00Z", sellerSubOrders: [{ subOrderId: "so1", subOrderNumber: "SO-2026-000123-S1", sellerOrganizationId: S1, status: "PENDING_CONFIRMATION", materialSubtotal: 1000, materialVat: 50, subOrderTotal: 1050, confirmationDeadlineUtc: "2026-11-21T10:00:00Z", deliveryMode: "SELF_COLLECTION", deliveryFeeSubtotal: 0, deliveryVatAmount: 0 }] };

function render(s = status()) {
  const onCartStale = vi.fn();
  const onRecheck = vi.fn();
  renderWithApp([{ path: "/checkout", element: <PlaceOrder s={s} cartVersion={RV} onCartStale={onCartStale} onRecheck={onRecheck} /> }, { path: "/account/orders/:id", element: <p>order page</p> }], "/checkout");
  return { onCartStale, onRecheck };
}

describe("order placement (handoff 20 Nov 2026 §4.3, gated)", () => {
  it("is offered only for a provider-verified authorisation with stock protected and no order yet", () => {
    expect(canPlaceOrder(status())).toBe(true);
    expect(canPlaceOrder(status({ checkoutStage: "ORDER_PLACEMENT_PENDING" }))).toBe(true);
    expect(canPlaceOrder(status({ isProviderVerified: false }))).toBe(false);
    expect(canPlaceOrder(status({ checkoutStage: "AUTHORIZATION_PROCESSING" }))).toBe(false);
    expect(canPlaceOrder(status({ orderPlaced: true, orderId: ORDER, checkoutStage: "ORDER_CREATED" }))).toBe(false);
    expect(hasPlacedOrder(status({ checkoutStage: "SELLER_CONFIRMATION_PENDING", orderId: ORDER }))).toBe(true);
  });

  it("collection for each seller in the authorisation, once per seller", () => {
    expect(collectionSelections(status())).toEqual([
      { sellerId: S1, sellerOrganizationId: S1, deliveryMode: "SELF_COLLECTION", shippingOptionCode: null, overrideDeliveryAddressId: null, buyerDeliveryInstructions: null },
      { sellerId: S2, sellerOrganizationId: null, deliveryMode: "SELF_COLLECTION", shippingOptionCode: null, overrideDeliveryAddressId: null, buyerDeliveryInstructions: null },
    ]);
  });

  it("posts the authorisation with If-Match and Idempotency-Key, and shows the order only when the server placed it", async () => {
    const { calls } = mockFetch([{ method: "POST", path: "/api/v1/buyer/checkout/orders", respond: () => ({ body: placed }) }]);
    render();
    expect(screen.getByText("Collect from seller")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Place order · AED\s1,050\.00/ }));
    expect(await screen.findByText(/Order placed · SO-2026-000123/)).toBeInTheDocument();
    expect(screen.getByText("SO-2026-000123-S1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View order" })).toHaveAttribute("href", `/account/orders/${ORDER}`);
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.headers.get("If-Match")).toBe(`"${RV}"`);
    expect(post.headers.get("Idempotency-Key")).toMatch(/^[A-Za-z0-9_.-]{8,100}$/);
    expect(post.body).toEqual({ paymentAuthorizationAttemptId: ATTEMPT, cartId: CART, purchasingOrganizationId: ORG, deliveryAddressId: null, expectedPayableTotal: 1050, currency: "AED", sellerSelections: collectionSelections(status()) });
  });

  it("503 ORDER_PLACEMENT_DISABLED: explains, no success, button off", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/buyer/checkout/orders", respond: () => ({ status: 503, body: { status: 503, code: "ORDER_PLACEMENT_DISABLED" } }) }]);
    render();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));
    expect(await screen.findByText(/Ordering isn't open yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place order/ })).toBeDisabled();
    expect(screen.queryByText(/Order placed/)).not.toBeInTheDocument();
  });

  it("a retry after a definite failure reuses the same idempotency key", async () => {
    let n = 0;
    const { calls } = mockFetch([{ method: "POST", path: "/api/v1/buyer/checkout/orders", respond: () => (++n === 1 ? { status: 409, body: { status: 409, code: "ORDER_PLACEMENT_RESERVATION_NOT_HELD" } } : { body: placed }) }]);
    render();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));
    expect(await screen.findByText(/no longer reserved/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await screen.findByText(/Order placed/);
    const keys = calls.filter((c) => c.method === "POST").map((c) => c.headers.get("Idempotency-Key"));
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it("uncertain commit: never retried automatically, says don't order again", async () => {
    const { calls } = mockFetch([{ method: "POST", path: "/api/v1/buyer/checkout/orders", respond: () => ({ status: 500, body: { status: 500, code: "ORDER_COMMIT_UNCERTAIN" } }) }]);
    const { onRecheck } = render();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));
    expect(await screen.findByText(/don't place the order again/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order|Try again/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Check status/ }));
    expect(onRecheck).toHaveBeenCalled();
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
  });

  it("a stale cart asks the page to reload it", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/buyer/checkout/orders", respond: () => ({ status: 409, body: { status: 409, code: "ORDER_PLACEMENT_SNAPSHOT_MISMATCH" } }) }]);
    const { onCartStale } = render();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));
    await waitFor(() => expect(onCartStale).toHaveBeenCalled());
  });

  it("an order the server already holds is shown, with no second Place order; reconciliation says wait", () => {
    render(status({ orderPlaced: true, orderId: ORDER, orderNumber: "SO-2026-000123", checkoutStage: "ORDER_CREATED" }));
    expect(screen.getByText(/Order placed · SO-2026-000123/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
  });

  it("reconciliation required: pending, no button", () => {
    render(status({ checkoutStage: "CHECKOUT_RECONCILIATION_REQUIRED" }));
    expect(screen.getByText(/Please don't place it again/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
  });
});
