import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { PaymentStep } from "../payment-step";
import type { CheckoutValidationResult } from "@/api/types/orders";

vi.mock("@/lib/orders/order-api", async (orig) => {
  const m = await orig<typeof import("@/lib/orders/order-api")>();
  return { ...m, ORDER_API: { ...m.ORDER_API, paymentPreAuth: true, placeOrder: true } };
});
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: vi.fn(async () => null) }));

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const CART = "c1000000-0000-4000-8000-000000000001";
const ATTEMPT = "a1000000-0000-4000-8000-0000000000aa";
const RV = "AAAAAAAAB9Q=";
const readiness = { canProceed: true, currency: "AED", estimatedPayableTotal: 1050, blockers: [], sellerSubOrders: [] } as unknown as CheckoutValidationResult;
const authorised = {
  attemptId: ATTEMPT, checkoutCorrelationId: "corr", cartId: CART, buyerUserId: "u", buyerOrganizationId: null, buyerAccountType: "INDIVIDUAL", paymentProvider: "STRIPE", paymentIntentId: "pi_1", clientSecret: null,
  captureMethod: "manual", providerStatus: "requires_capture", internalStatus: "AUTHORIZED", authorizedAmount: 1050, capturableAmount: 1050, materialSubtotal: 1000, vatAmount: 50, deliveryAmount: 0, deliveryVatAmount: 0,
  currency: "AED", reservationStatus: "HELD_POST_AUTH", earliestReservationExpiresAtUtc: null, threeDsRequired: false, threeDsCompletedAtUtc: null, paymentAuthorizedAtUtc: null, authorizationExpiresAtUtc: null,
  isProviderVerified: true, recoveryStatus: "NONE", failureCode: null, failureMessage: null, createdAtUtc: "2026-11-20T10:00:00Z", updatedAtUtc: null, reservations: [], orderId: null, orderNumber: null, orderPlaced: false,
  recommendedPollIntervalSeconds: 5, maxActivePollingDurationSeconds: 120, pollingWindowExpiresAtUtc: null, shouldContinueActivePolling: false, isDelayedProcessing: false, canManualRefresh: true,
  browserCallbackIsAuthoritative: false, checkoutStage: "INVENTORY_PROTECTED",
};

describe("payment step with ordering on", () => {
  it("after a provider-verified authorisation, offers Place order (freight, with the chosen address) and no cancel-only dead end", async () => {
    sessionStorage.setItem(`stockout.market.preauth.${CART}`, JSON.stringify({ cartId: CART, cartVersion: RV, idempotencyKey: "k", checkoutCorrelationId: "corr", expectedTotalAmount: 1050, attemptId: ATTEMPT }));
    mockFetch([{ method: "GET", path: `/api/v1/buyer/checkout/payment-authorizations/${ATTEMPT}`, respond: () => ({ body: authorised }) }]);
    renderWithApp([{ path: "/checkout", element: <PaymentStep cart={{ cartId: CART, buyerOrganizationId: null }} cartVersion={RV} readiness={readiness} publishableKey="pk_test_1" deliveryAddressId="ad000000-0000-4000-8000-000000000001" onCartStale={() => {}} onReadinessStale={() => {}} /> }], "/checkout");
    expect(await screen.findByText(/Place your order to finish/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place order · AED\s1,050\.00/ })).toBeEnabled();
  });
});
