import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { PaymentStep } from "../payment-step";
import type { CheckoutValidationResult } from "@/api/types/orders";

// Stripe.js can't run in jsdom: a stand-in Payment Element that is ready at once, and a spy for confirmPayment.
const stripe = vi.hoisted(() => {
  const confirmPayment = vi.fn(async (_opts: unknown) => ({ paymentIntent: { status: "requires_capture" } }) as { paymentIntent?: unknown; error?: { type: string; message?: string } });
  const element = { on: (_e: string, cb: () => void) => setTimeout(cb, 0), mount: vi.fn(), destroy: vi.fn() };
  const elements = vi.fn((_opts: unknown) => ({ create: () => element }));
  return { confirmPayment, elements, element };
});
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: vi.fn(async () => ({ elements: stripe.elements, confirmPayment: stripe.confirmPayment })) }));

afterEach(() => {
  vi.unstubAllGlobals();
  stripe.confirmPayment.mockClear();
  stripe.elements.mockClear();
  localStorage.clear();
  sessionStorage.clear();
});

const BASE = "/api/v1/buyer/checkout/payment-authorizations";
const CART = "c1000000-0000-4000-8000-000000000001";
const ORG = "3934b874-33be-474d-9e12-247a0290c77e";
const ATTEMPT = "a1000000-0000-4000-8000-0000000000aa";
const RV = "AAAAAAAAB9Q=";
const readiness = { canProceed: true, currency: "AED", estimatedPayableTotal: 1050, blockers: [], sellerSubOrders: [] } as unknown as CheckoutValidationResult;

const attempt = (over: Record<string, unknown> = {}) => ({
  attemptId: ATTEMPT, checkoutCorrelationId: "corr", cartId: CART, cartVersion: RV, buyerUserId: "u-1", buyerOrganizationId: ORG, buyerAccountType: "BUSINESS", paymentProvider: "STRIPE",
  paymentIntentId: "pi_1", clientSecret: null, captureMethod: "manual", providerStatus: "requires_payment_method", internalStatus: "REQUIRES_PAYMENT_METHOD", authorizedAmount: 1050,
  capturableAmount: 0, materialSubtotal: 1000, vatAmount: 50, deliveryAmount: 0, deliveryVatAmount: 0, currency: "AED", reservationStatus: "ACTIVE_RESERVED",
  earliestReservationExpiresAtUtc: "2026-11-18T10:15:00Z", threeDsRequired: false, threeDsCompletedAtUtc: null, paymentAuthorizedAtUtc: null, authorizationExpiresAtUtc: null,
  isProviderVerified: false, recoveryStatus: "NONE", failureCode: null, failureMessage: null, createdAtUtc: "2026-11-18T10:00:00Z", updatedAtUtc: null, reservations: [],
  orderId: null, orderNumber: null, orderPlaced: false, recommendedPollIntervalSeconds: 1, maxActivePollingDurationSeconds: 120, pollingWindowExpiresAtUtc: "2999-01-01T00:00:00Z",
  shouldContinueActivePolling: true, isDelayedProcessing: false, canManualRefresh: true, browserCallbackIsAuthoritative: false, checkoutStage: "AUTHORIZATION_PROCESSING", isIdempotentReplay: false,
  ...over,
});
const authorised = attempt({ internalStatus: "AUTHORIZED", isProviderVerified: true, providerStatus: "requires_capture", capturableAmount: 1050, shouldContinueActivePolling: false, authorizationExpiresAtUtc: "2026-11-25T10:00:00Z" });

function render(path = "/checkout", props: Partial<React.ComponentProps<typeof PaymentStep>> = {}) {
  const onCartStale = vi.fn();
  const onReadinessStale = vi.fn();
  const utils = renderWithApp(
    [{ path: "/checkout", element: <PaymentStep cart={{ cartId: CART, buyerOrganizationId: ORG }} cartVersion={RV} readiness={readiness} publishableKey="pk_test_123" onCartStale={onCartStale} onReadinessStale={onReadinessStale} {...props} /> }],
    path,
  );
  return { ...utils, onCartStale, onReadinessStale };
}
const store = (over: Record<string, unknown> = {}) =>
  sessionStorage.setItem(`stockout.market.preauth.${CART}`, JSON.stringify({ cartId: CART, cartVersion: RV, idempotencyKey: "key-old", checkoutCorrelationId: "corr", expectedTotalAmount: 1050, attemptId: ATTEMPT, ...over }));

describe("checkout payment authorisation (Stripe sandbox, handoff 18 Nov §7)", () => {
  it("initiates with If-Match + Idempotency-Key, confirms with Stripe, and shows a provider-verified hold, never an order", async () => {
    let confirmed = false;
    stripe.confirmPayment.mockImplementationOnce(async () => ((confirmed = true), { paymentIntent: { status: "requires_capture" } }));
    const { calls } = mockFetch([
      { method: "POST", path: BASE, respond: () => ({ body: attempt({ clientSecret: "pi_1_secret_abc" }) }) },
      { method: "GET", path: `${BASE}/${ATTEMPT}`, respond: () => ({ body: confirmed ? authorised : attempt() }) },
    ]);
    render();
    expect(screen.getByText("Amount to authorise: AED 1,050.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue to card payment/ }));

    const post = await waitFor(() => {
      const c = calls.find((x) => x.method === "POST");
      expect(c).toBeDefined();
      return c!;
    });
    expect(post.headers.get("If-Match")).toBe(`"${RV}"`);
    const key = post.headers.get("Idempotency-Key");
    expect(key).toBeTruthy();
    expect(post.body).toMatchObject({ cartId: CART, cartVersion: RV, purchasingOrganizationId: ORG, expectedTotalAmount: 1050, currency: "AED", idempotencyKey: key });

    // Payment Element mounted with the backend's client secret; confirm goes to Stripe with our return page.
    await userEvent.click(await screen.findByRole("button", { name: /Authorise AED\s1,050\.00/ }));
    expect(stripe.elements).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: "pi_1_secret_abc" }));
    const opts = stripe.confirmPayment.mock.calls[0][0] as { confirmParams: { return_url: string }; redirect: string };
    expect(opts.redirect).toBe("if_required");
    expect(opts.confirmParams.return_url).toBe(`${window.location.origin}/checkout?payment_attempt=${ATTEMPT}`);

    expect(await screen.findByText("Payment authorised")).toBeInTheDocument();
    expect(screen.getByText(/is held on your card, not charged\. Your order isn't placed yet\./)).toBeInTheDocument();
    expect(screen.queryByText(/order placed|payment captured|paid/i)).not.toBeInTheDocument();
    // Only the canonical status route; the secret is never stored.
    expect(calls.some((c) => c.url.pathname.includes("pre-auth/status"))).toBe(false);
    expect(JSON.stringify(sessionStorage)).not.toContain("secret");
  });

  it("AUTHORIZED without provider verification is not shown as authorised; when polling ends it offers a manual check", async () => {
    store();
    mockFetch([{ method: "GET", path: `${BASE}/${ATTEMPT}`, respond: () => ({ body: attempt({ internalStatus: "AUTHORIZED", isProviderVerified: false, shouldContinueActivePolling: false, isDelayedProcessing: true }) }) }]);
    render();
    expect(await screen.findByText("Verification delayed")).toBeInTheDocument();
    expect(screen.queryByText("Payment authorised")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check again/ })).toBeInTheDocument();
  });

  it("an uncertain initiation (5xx) is retried with the SAME Idempotency-Key and body", async () => {
    let n = 0;
    const { calls } = mockFetch([
      { method: "POST", path: BASE, respond: () => (++n === 1 ? { status: 503, body: { status: 503, title: "Unavailable", code: "STRIPE_API_UNAVAILABLE" } } : { body: attempt({ clientSecret: "pi_1_secret_abc" }) }) },
      { method: "GET", path: `${BASE}/${ATTEMPT}`, respond: () => ({ body: attempt() }) },
    ]);
    render();
    await userEvent.click(screen.getByRole("button", { name: /Continue to card payment/ }));
    expect(await screen.findByText(/temporarily unavailable\. Nothing was charged/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(2));
    const [a, b] = calls.filter((c) => c.method === "POST");
    expect(b.headers.get("Idempotency-Key")).toBe(a.headers.get("Idempotency-Key"));
    expect(b.body).toEqual(a.body);
  });

  it("a total mismatch re-checks readiness and the next try uses a new key; a stale cart asks for a reload", async () => {
    let n = 0;
    const { calls } = mockFetch([
      {
        method: "POST",
        path: BASE,
        respond: () =>
          ++n === 1 ? { status: 409, body: { status: 409, title: "Conflict", code: "PAYMENT_PREAUTH_AMOUNT_MISMATCH" } } : { status: 409, body: { status: 409, title: "Conflict", code: "CART_CONCURRENCY_CONFLICT" } },
      },
    ]);
    const { onReadinessStale, onCartStale } = render();
    await userEvent.click(screen.getByRole("button", { name: /Continue to card payment/ }));
    expect(await screen.findByText(/Your total changed/)).toBeInTheDocument();
    expect(onReadinessStale).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(onCartStale).toHaveBeenCalled());
    const keys = calls.filter((c) => c.method === "POST").map((c) => c.headers.get("Idempotency-Key"));
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("a declined authorisation shows the failure and starts a NEW attempt on Try again", async () => {
    store();
    const { calls } = mockFetch([
      { method: "GET", path: `${BASE}/${ATTEMPT}`, respond: () => ({ body: attempt({ internalStatus: "AUTHORIZATION_FAILED", failureCode: "card_declined", failureMessage: "Your card was declined.", shouldContinueActivePolling: false }) }) },
      { method: "POST", path: BASE, respond: () => ({ body: attempt({ attemptId: "a2000000-0000-4000-8000-0000000000bb", clientSecret: "pi_2_secret" }) }) },
      { method: "GET", path: `${BASE}/a2000000-0000-4000-8000-0000000000bb`, respond: () => ({ body: attempt({ attemptId: "a2000000-0000-4000-8000-0000000000bb" }) }) },
    ]);
    render();
    expect(await screen.findByText("Your card was declined.")).toBeInTheDocument();
    expect(screen.getByText("Reference: card_declined")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
    expect(calls.find((c) => c.method === "POST")!.headers.get("Idempotency-Key")).not.toBe("key-old");
  });

  it("a protected authorised hold can't be cancelled here (409 PAYMENT_PREAUTH_ALREADY_AUTHORIZED_PROTECTED)", async () => {
    store();
    mockFetch([
      { method: "GET", path: `${BASE}/${ATTEMPT}`, respond: () => ({ body: authorised }) },
      { method: "POST", path: `${BASE}/${ATTEMPT}/cancel`, respond: () => ({ status: 409, body: { status: 409, title: "Conflict", code: "PAYMENT_PREAUTH_ALREADY_AUTHORIZED_PROTECTED" } }) },
    ]);
    render();
    await userEvent.click(await screen.findByRole("button", { name: /Cancel payment/ }));
    expect(await screen.findByText(/already authorised and held for your order/)).toBeInTheDocument();
    expect(screen.getByText("Payment authorised")).toBeInTheDocument();
  });

  it("back from 3DS: resumes the attempt from the return URL, polls the status and removes Stripe's parameters", async () => {
    store({ cartVersion: "AAAAAAAAB9Z=" });
    let polls = 0;
    mockFetch([{ method: "GET", path: `${BASE}/${ATTEMPT}`, respond: () => ({ body: ++polls < 2 ? attempt({ internalStatus: "PROCESSING" }) : authorised }) }]);
    const { router } = render(`/checkout?payment_attempt=${ATTEMPT}&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_abc&redirect_status=succeeded`);
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByText("Payment authorised", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(polls).toBeGreaterThanOrEqual(2);
  });

  it("stays closed until checkout readiness allows it", () => {
    mockFetch([]);
    render("/checkout", { readiness: { ...readiness, canProceed: false } });
    expect(screen.getByRole("button", { name: /Continue to card payment/ })).toBeDisabled();
    expect(screen.getByText(/opens once your cart is ready/)).toBeInTheDocument();
  });
});
