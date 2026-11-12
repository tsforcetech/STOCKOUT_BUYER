import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import CheckoutPage from "../checkout-page";
import CartPage from "@/features/cart/cart-page";
import OrderDetailPage from "@/features/orders/order-detail-page";
import MyOrdersPage from "@/features/orders/my-orders-page";
import SellerOrdersPage from "@/features/orders/seller-orders-page";
import SellerOrderDetailPage from "@/features/orders/seller-order-detail-page";
import { RequireSeller } from "@/features/seller/require-seller";
import { BuyerOrderDetail, SellerSubOrderDetail } from "@/features/orders/components/order-views";
import { commerceKeys } from "@/lib/cart/server-cart";
import { ORDER_API } from "@/lib/orders/order-api";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import type { CheckoutValidationResult, MarketplaceOrderDto, SellerSubOrderDto } from "@/api/types/orders";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "33333333-3333-4333-8333-333333333333";
const signIn = () => {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
};
const item = (over: object = {}) => ({
  cartItemId: "ci-1", listingId: L1, sellerId: "s-1", title: "Copper Wire Spool 16mm", thumbnailUrl: null, quantity: 5, addedPrice: 100, currentPrice: 100,
  addedCurrency: "AED", currentCurrency: "AED", hasPriceChanged: false, priceDifference: 0, stockAvailable: 20, hasSufficientStock: true,
  isActive: true, isPurchasable: true, itemState: "ACTIVE", statusMessage: null, lineSubtotal: 500, ...over,
});
const cart = (over: Partial<BuyerCartResponse> = {}): BuyerCartResponse => ({
  cartId: "c-1", buyerId: "u-1", itemCount: 2, totalQuantity: 7, totalSubtotal: 1000, estimatedVatRatePercent: 7.5, estimatedVatAmount: 75, estimatedTotal: 1075,
  currency: "AED", rowVersion: "AAAAAAAAB9Q=", updatedAt: "2026-11-05T07:14:13Z",
  sellerGroups: [
    { sellerId: "s-1", sellerDisplayName: "Al Futtaim Engineering LLC", groupSubtotal: 500, items: [item()] },
    { sellerId: "s-2", sellerDisplayName: "Apex Steel", groupSubtotal: 500, items: [item({ cartItemId: "ci-2", listingId: L2, sellerId: "s-2", title: "HEB 300 Steel Beam", quantity: 2, currentPrice: 250 })] },
  ],
  checkoutReadiness: { canProceed: true, blockers: [] },
  ...over,
});
const profile = {
  buyerId: "b-1", organizationId: "o-1", organizationType: "BUSINESS", legalName: "Gulf Build Contracting LLC", tradingName: "Gulf Build", tradeLicenseNumber: "DED-778812",
  issuingAuthority: "DED", tradeLicenseIssuedAtUtc: null, tradeLicenseExpiresAtUtc: "2027-06-30T00:00:00Z", isVatRegistered: true, taxRegistrationNumber: "100234567800003",
  hasVatDeclaration: false, signatoryName: "Sara Khan", signatoryEmail: "sara@gulfbuild.ae", signatoryPhone: null, signatoryAuthorityRole: "Manager",
  businessContactEmail: null, businessContactPhone: null, addressLine1: "Warehouse 4, Al Quoz 3", addressLine2: null, city: "Dubai", stateOrEmirate: "Dubai", postalCode: null,
  countryCode: "ARE", defaultCurrency: "AED", bankName: null, bankAccountNumber: null, bankIban: null, bankSwiftCode: null, bankBeneficiaryName: null,
  verificationStatus: "VERIFIED", orgStatus: "ACTIVE", submittedAtUtc: null, verifiedAtUtc: null, rejectedAtUtc: null, suspendedAtUtc: null, rejectionReason: null,
  suspensionReason: null, canPurchase: true, mandatoryDocumentsComplete: true, missingDocumentCategories: [], pendingPolicies: [], documents: [],
  createdAtUtc: "2026-10-01T00:00:00Z", updatedAtUtc: "2026-10-01T00:00:00Z", rowVersion: "AAAAAAAAAAE=",
};
const eligibility = { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => ({ body: { success: true, data: { buyerId: "u-1", eligible: true, verificationStatus: "NOT_REQUIRED", canPurchase: true, reason: null } } }) };
const profileOk = { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => ({ body: { success: true, data: profile } }) };
const profile404 = { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => ({ status: 404, body: { status: 404, title: "Not Found", code: "MARKETPLACE_BUYER_NOT_FOUND" } }) };
const wishIds = { method: "GET", path: "/api/v1/buyer/wishlist", respond: () => ({ body: { wishlistId: "w", buyerId: "u-1", totalItems: 0, pageNumber: 1, pageSize: 100, items: [] } }) };
const saved = { method: "GET", path: "/api/v1/buyer/cart/saved-items", respond: () => ({ body: { items: [], totalCount: 0 } }) };
const page = (element: React.ReactNode, path: string, at = path) =>
  renderWithApp([{ element: <RequireAuth />, children: [{ path, element }] }, { path: "/login", element: <div>login</div> }], at);

const line = (over: object = {}) => ({
  listingId: L1, sellerId: "s-1", title: "Copper Wire Spool 16mm", thumbnailUrl: null, quantity: 5, unitPrice: 100, currency: "AED", taxRatePercent: 7.5, taxAmount: 37.5,
  lineSubtotal: 500, lineTotal: 537.5, isPurchasable: true, blockerCode: null, blockerMessage: null, ...over,
});
const readiness = (over: Partial<CheckoutValidationResult> = {}): CheckoutValidationResult => ({
  canProceed: true, cartId: "c-1", buyerUserId: "u-1", buyerProfileId: "b-1", buyerOrganizationId: "o-1", currency: "AED", totalDistinctItems: 2, totalQuantity: 7,
  totalMaterialSubtotal: 1000, applicableVatRatePercent: 7.5, estimatedVatAmount: 75, estimatedPayableTotal: 1075,
  sellerSubOrders: [
    { sellerId: "s-1", sellerDisplayName: "Al Futtaim Engineering LLC", groupSubtotal: 500, groupVatAmount: 37.5, groupTotal: 537.5, lines: [line()] },
    { sellerId: "s-2", sellerDisplayName: "Apex Steel", groupSubtotal: 500, groupVatAmount: 37.5, groupTotal: 537.5, lines: [line({ listingId: L2, sellerId: "s-2", title: "HEB 300 Steel Beam", quantity: 2, unitPrice: 250 })] },
  ],
  blockers: [], cartRowVersion: "AAAAAAAAB9Q=", ...over,
});
const readinessRoute = (body: () => unknown, status = 200) => ({ method: "GET", path: "/api/v1/buyer/checkout/readiness", respond: () => ({ status, body: body() }) });

describe("Stage 8C checkout readiness", () => {
  it("shows readiness totals and seller breakdown, sends the reviewed rowVersion as If-Match, and keeps Continue to payment disabled", async () => {
    signIn();
    const { calls } = mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, readinessRoute(() => readiness()), eligibility, profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(await within(summary).findByText("Estimated UAE VAT (7.5%)")).toBeInTheDocument(); // rate from the API, never a hardcoded 5%
    expect(within(summary).getByText(/1,075/)).toBeInTheDocument();
    expect(within(summary).getByText(/7 units, 2 items/)).toBeInTheDocument();
    const items = screen.getByRole("region", { name: "Items" });
    expect(within(items).getByText("Al Futtaim Engineering LLC")).toBeInTheDocument();
    expect(within(items).getAllByText(/537\.5/).length).toBeGreaterThan(0); // group total from readiness
    expect(within(summary).getByRole("button", { name: /Continue to payment/ })).toBeDisabled();
    expect(within(summary).getByText(/Readiness confirmed. Ordering will be available in a later release/)).toBeInTheDocument();
    const rc = calls.find((c) => c.url.pathname === "/api/v1/buyer/checkout/readiness");
    expect(rc?.headers.get("If-Match")).toBe('"AAAAAAAAB9Q="');
    expect(ORDER_API.placeOrder).toBe(false);
    await userEvent.click(screen.getByRole("radio", { name: /Collect from seller/ }));
    expect(screen.queryByText(/Bank transfer|Corporate cheque/)).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method !== "GET" && !c.url.pathname.startsWith("/api/v1/auth/"))).toEqual([]);
    expect(calls.some((c) => c.url.pathname.includes("/orders"))).toBe(false);
  });

  it("shows the backend's blockers: organisation gate, line issues with exact quantity rule, identity link", async () => {
    signIn();
    const r = readiness({
      canProceed: false,
      blockers: [
        { code: "BUYER_ORGANIZATION_REQUIRED", message: "A verified purchasing corporate organization is required.", listingId: null },
        { code: "BUYER_IDENTITY_VERIFICATION_REQUIRED", message: "x", listingId: null },
      ],
      sellerSubOrders: [
        { sellerId: "s-1", sellerDisplayName: "Al Futtaim Engineering LLC", groupSubtotal: 500, groupVatAmount: 37.5, groupTotal: 537.5, lines: [line({ isPurchasable: false, blockerCode: "COMMERCE_MIN_ORDER_QTY_NOT_MET", blockerMessage: "Minimum order quantity is 10 units." })] },
        { sellerId: "s-2", sellerDisplayName: "Apex Steel", groupSubtotal: 500, groupVatAmount: 37.5, groupTotal: 537.5, lines: [line({ listingId: L2, sellerId: "s-2", isPurchasable: false, blockerCode: "INSUFFICIENT_STOCK", blockerMessage: "y" })] },
      ],
    });
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, readinessRoute(() => r), eligibility, profile404, wishIds]);
    page(<CheckoutPage />, "/checkout");
    const buyer = await screen.findByRole("region", { name: "Buyer" });
    expect(await within(buyer).findByText(/You buy as a business. Choose the company you.re buying for at checkout/)).toBeInTheDocument(); // not "allowed to buy"
    expect(within(buyer).queryByText(/allowed to buy/)).not.toBeInTheDocument();
    expect(screen.getByText("Minimum order quantity is 10 units.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/less stock than you asked for/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Fix in cart" })).toHaveLength(2);
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByText(/Checkout is blocked for your account/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Verify my identity" })).toHaveAttribute("href", "/account/verification");
    expect(within(summary).getByRole("button", { name: /Continue to payment/ })).toBeDisabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("a readiness failure fails closed with a retry, never totals from the browser", async () => {
    signIn();
    let fail = true;
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, { method: "GET", path: "/api/v1/buyer/checkout/readiness", respond: () => (fail ? { status: 503, body: {} } : { body: readiness() }) }, eligibility, profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByText(/couldn't check your cart for checkout/, {}, { timeout: 4000 })).toBeInTheDocument();
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(summary).queryByText(/1,075/)).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(within(summary).getByRole("button", { name: /Try again/ }));
    expect(await within(summary).findByText(/1,075/)).toBeInTheDocument();
  });

  it("never shows internal backend reasons for an unavailable eligibility check", async () => {
    signIn();
    const internal = { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => ({ body: { success: true, data: { buyerId: "u-1", eligible: false, verificationStatus: "UNAVAILABLE", canPurchase: false, reason: "Authoritative identity service configuration (IdentityAccess:InternalUrl) is missing." } } }) };
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, readinessRoute(() => readiness()), internal, profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByText(/couldn't confirm your buying access/)).toBeInTheDocument();
    expect(screen.queryByText(/IdentityAccess/)).not.toBeInTheDocument();
  });

  it("409 CART_CONCURRENCY_CONFLICT asks the buyer to reload, then re-runs readiness with the new rowVersion", async () => {
    signIn();
    let version = "AAAAAAAAB9Q=";
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart({ rowVersion: version }) }) },
      {
        method: "GET",
        path: "/api/v1/buyer/checkout/readiness",
        respond: ({ init }: { init: RequestInit }) =>
          new Headers(init.headers).get("If-Match") === '"AAAAAAAAB9Q="' && version !== "AAAAAAAAB9Q="
            ? { status: 409, body: { status: 409, code: "CART_CONCURRENCY_CONFLICT", detail: "Cart has been modified concurrently." } }
            : { body: readiness({ estimatedPayableTotal: version === "AAAAAAAAB9Q=" ? 1075 : 2150, cartRowVersion: version }) },
      },
      eligibility, profileOk, wishIds,
    ]);
    const { queryClient } = page(<CheckoutPage />, "/checkout");
    expect(await screen.findByText(/1,075/)).toBeInTheDocument();
    version = "AAAAAAAAB9g=";
    await act(() => queryClient.refetchQueries({ queryKey: commerceKeys.cart }));
    expect(await screen.findByText(/Your cart was updated in another session/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Reload/ }));
    expect(await screen.findByText(/2,150/)).toBeInTheDocument();
    expect(screen.queryByText(/Your cart was updated in another session/)).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.endsWith("/readiness") && c.headers.get("If-Match") === '"AAAAAAAAB9g="')).toBe(true);
  });

  it("cart page: Proceed to checkout only when the backend says the cart can proceed", async () => {
    signIn();
    let ready = true;
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart({ checkoutReadiness: { canProceed: ready, blockers: ready ? [] : [{ code: "BUYER_IDENTITY_VERIFICATION_REQUIRED", message: "x", listingId: null }] } }) }) }, eligibility, saved, wishIds]);
    const first = page(<CartPage />, "/cart");
    expect(await screen.findByRole("link", { name: /Proceed to checkout/ })).toHaveAttribute("href", "/checkout");
    first.unmount();
    ready = false;
    page(<CartPage />, "/cart");
    expect(await screen.findByRole("button", { name: /Proceed to checkout/ })).toBeDisabled();
  });
});

const O1 = "7b538e12-4f11-49b8-bc79-432859b83b10";
const SO1 = "9d1c1d2e-1111-4222-8333-444455556666";
const SELLER = "3934b874-33be-474d-9e12-247a0290c77e";
const oline = { orderLineId: "ol-1", subOrderId: SO1, listingId: L1, sellerId: SELLER, titleSnapshot: "HEB 300 Steel Beam Grade S355JR", thumbnailUrlSnapshot: null, quantity: 10, unitPrice: 250, currency: "AED", taxRatePercent: 5, taxAmount: 125, lineSubtotal: 2500, lineTotal: 2625, isWholeLot: false, minOrderQuantity: 1 };
const hist = (from: string, to: string, at: string, id: string) => ({ historyId: id, orderId: O1, subOrderId: SO1, entityType: "SUB_ORDER", fromStatus: from, toStatus: to, changedBy: "system", reasonOrNote: null, changedAtUtc: at });
const sub = (over: Partial<SellerSubOrderDto> = {}): SellerSubOrderDto => ({
  subOrderId: SO1, parentOrderId: O1, subOrderNumber: "SO-ORD-20261109-88A92F-S1", sellerOrganizationId: SELLER, sellerLegalName: "Apex Steel LLC", sellerTradingName: "Apex Steel",
  sellerTaxRegistrationNumber: null, materialSubtotal: 2500, applicableMaterialVat: 125, subOrderTotal: 2625, status: "PENDINGCONFIRMATION", fulfillmentStatus: "NOTSTARTED",
  claimStatus: "NONE", payoutEligibility: "NOTELIGIBLE", purchasedAtUtc: null, deliveredAtUtc: null, isDeliveryProofVerified: false, deliveryProofReference: null,
  deliveryProofVerifiedBy: null, deliveryProofVerifiedAtUtc: null, holdingPeriodReferenceDateUtc: null, holdingPeriodStartDateUtc: null, holdingPeriodEndDateUtc: null,
  missingHoldingCalculationDependency: null, sellerConfirmedAtUtc: null, sellerRejectedAtUtc: null, sellerRejectionReason: null, rowVersion: "AAAAAAAAB/E=",
  createdAtUtc: "2026-11-09T10:15:30Z", updatedAtUtc: null, items: [oline],
  statusHistory: [hist("PENDING_CONFIRMATION", "CONFIRMED", "2026-11-09T12:00:00Z", "h2"), hist("", "PENDING_CONFIRMATION", "2026-11-09T10:15:30Z", "h1")], ...over,
});
const order = (over: Partial<MarketplaceOrderDto> = {}): MarketplaceOrderDto => ({
  orderId: O1, orderNumber: "ORD-20261109-88A92F", buyerUserId: "u-1", buyerOrganizationId: "org-b", orderDateUtc: "2026-11-09T10:15:30Z", currency: "AED",
  aggregateMaterialAmount: 2500, applicableMaterialVat: 125, deliveryAmount: 0, deliveryVatAmount: 0, totalPayableAmount: 2625, status: "PENDINGCONFIRMATION", paymentStatus: "PENDINGAUTHORIZATION",
  paymentReference: null, lifecycleVersion: 1, rowVersion: "AAAAAAAAB/A=", createdAtUtc: "2026-11-09T10:15:30Z", updatedAtUtc: null, subOrders: [sub()], statusHistory: [], ...over,
});
const sellerCtx = [{ sellerId: SELLER, sellerType: "BUSINESS", displayName: "Apex Steel", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true }];
const sellerPage = (element: React.ReactNode, path: string, at = path) =>
  renderWithApp([{ element: <RequireAuth />, children: [{ element: <RequireSeller />, children: [{ path, element }] }] }, { path: "/login", element: <div>login</div> }], at);

describe("Stage 8C buyer orders (read only)", () => {
  it("lists orders with API statuses and loads the next page until a short page, never sending a status filter", async () => {
    signIn();
    const many = Array.from({ length: 20 }, (_, i) => order({ orderId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, orderNumber: `ORD-P1-${i}` }));
    const { calls } = mockFetch([
      ...sessionRoutes([]), wishIds, { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) },
      { method: "GET", path: "/api/v1/buyer/orders", respond: ({ url }: { url: URL }) => ({ body: url.searchParams.get("page") === "1" ? many : [order({ orderNumber: "ORD-P2-LAST" }), many[0]] }) },
    ]);
    page(<MyOrdersPage />, "/account/orders");
    expect(await screen.findByText("ORD-P1-0")).toBeInTheDocument();
    expect(screen.getAllByText("Awaiting seller confirmation").length).toBeGreaterThan(0); // "PENDINGCONFIRMATION" from the API
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("ORD-P2-LAST")).toBeInTheDocument();
    expect(screen.getAllByText("ORD-P1-0")).toHaveLength(1); // de-duplicated across pages
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    const listCalls = calls.filter((c) => c.url.pathname === "/api/v1/buyer/orders");
    expect(listCalls.map((c) => c.url.searchParams.get("page"))).toEqual(["1", "2"]);
    expect(listCalls.every((c) => !c.url.searchParams.has("status") && c.url.searchParams.get("pageSize") === "20")).toBe(true);
  });

  it("shows a friendly empty state", async () => {
    signIn();
    mockFetch([...sessionRoutes([]), wishIds, { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, { method: "GET", path: "/api/v1/buyer/orders", respond: () => ({ body: [] }) }]);
    page(<MyOrdersPage />, "/account/orders");
    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse marketplace" })).toBeInTheDocument();
  });

  it("order detail renders the DTO as given, with history in time order", async () => {
    signIn();
    mockFetch([...sessionRoutes([]), wishIds, { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, { method: "GET", path: `/api/v1/buyer/orders/${O1}`, respond: () => ({ body: order({ statusHistory: sub().statusHistory }) }) }]);
    page(<OrderDetailPage />, "/account/orders/:orderId", `/account/orders/${O1}`);
    expect(await screen.findByRole("heading", { name: "Order ORD-20261109-88A92F" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "From Apex Steel" })).toBeInTheDocument();
    expect(screen.getByText("Payment pending")).toBeInTheDocument();
    const total = screen.getByRole("complementary", { name: "Order total" });
    expect(within(total).getByText("Total payable").nextSibling).toHaveTextContent(/2,625/);
    const history = within(screen.getByRole("region", { name: "History" })).getAllByRole("listitem");
    expect(history[0]).toHaveTextContent("Awaiting confirmation");
    expect(history[1]).toHaveTextContent("Awaiting confirmation → Confirmed");
  });

  it("404 ORDER_NOT_FOUND shows the same generic not-found screen", async () => {
    signIn();
    mockFetch([...sessionRoutes([]), wishIds, { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, { method: "GET", path: `/api/v1/buyer/orders/${O1}`, respond: () => ({ status: 404, body: { status: 404, code: "ORDER_NOT_FOUND" } }) }]);
    page(<OrderDetailPage />, "/account/orders/:orderId", `/account/orders/${O1}`);
    expect(await screen.findByText("Order not found")).toBeInTheDocument();
  });
});

describe("Stage 8C seller orders (read only)", () => {
  it("fetches the queue for the active seller via sellerId and lists suborders", async () => {
    signIn();
    const { calls } = mockFetch([...sessionRoutes(sellerCtx), { method: "GET", path: "/api/v1/seller/orders", respond: () => ({ body: [sub()] }) }]);
    sellerPage(<SellerOrdersPage />, "/seller/orders");
    expect(await screen.findByText("SO-ORD-20261109-88A92F-S1")).toBeInTheDocument();
    const c = calls.find((x) => x.url.pathname === "/api/v1/seller/orders");
    expect(c?.url.searchParams.get("sellerId")).toBe(SELLER);
    expect(c?.url.searchParams.has("status")).toBe(false);
  });

  it("403 shows an access message and does not try another seller", async () => {
    signIn();
    const { calls } = mockFetch([...sessionRoutes(sellerCtx), { method: "GET", path: "/api/v1/seller/orders", respond: () => ({ status: 403, body: { status: 403, code: "MARKETPLACE_SELLER_ACCESS_DENIED" } }) }]);
    sellerPage(<SellerOrdersPage />, "/seller/orders");
    expect(await screen.findByText(/can.t view these orders/)).toBeInTheDocument();
    expect(new Set(calls.filter((x) => x.url.pathname === "/api/v1/seller/orders").map((x) => x.url.searchParams.get("sellerId")))).toEqual(new Set([SELLER]));
  });

  it("suborder detail shows lines, history and payout state; confirm/reject are live for a pending suborder", async () => {
    signIn();
    mockFetch([...sessionRoutes(sellerCtx), { method: "GET", path: `/api/v1/seller/orders/${SO1}`, respond: () => ({ body: sub() }) }]);
    sellerPage(<SellerOrderDetailPage />, "/seller/orders/:subOrderId", `/seller/orders/${SO1}`);
    expect(await screen.findByRole("heading", { name: "Order SO-ORD-20261109-88A92F-S1" })).toBeInTheDocument();
    expect(screen.getByText("HEB 300 Steel Beam Grade S355JR")).toBeInTheDocument();
    expect(screen.getByText("Not yet eligible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm order/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Reject order/ })).toBeEnabled();
    expect(within(screen.getByRole("region", { name: "History" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("view components render a DTO directly", () => {
    render(
      <MemoryRouter>
        <BuyerOrderDetail order={order()} />
        <SellerSubOrderDetail sub={sub({ statusHistory: [] })} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("No status changes recorded yet.").length).toBe(2);
  });
});

describe("Stage 8C.6 buyer capacity (OD-BUYER-01)", () => {
  it("a verified individual sees no company requirement and readiness confirmed, with ordering still disabled", async () => {
    signIn();
    const indiv = { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => ({ body: { success: true, data: { buyerId: "b-1", eligible: true, verificationStatus: "VERIFIED", canPurchase: true, reason: null, organizationType: "INDIVIDUAL", organizationId: null, authorizedOrganizationIds: null } } }) };
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, readinessRoute(() => readiness({ buyerOrganizationId: null })), indiv, profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    const buyer = await screen.findByRole("region", { name: "Buyer" });
    expect(await within(buyer).findByText(/Buying as an individual/)).toBeInTheDocument();
    expect(within(buyer).getByText("Your account is allowed to buy.")).toBeInTheDocument();
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(await within(summary).findByText(/Readiness confirmed/)).toBeInTheDocument();
    expect(within(summary).getByRole("button", { name: /Continue to payment/ })).toBeDisabled();
  });

  it("unauthorised company context and unknown codes get safe wording", async () => {
    signIn();
    const r = readiness({ canProceed: false, blockers: [{ code: "BUYER_ORGANIZATION_UNAUTHORIZED", message: "x", listingId: null }, { code: "SOMETHING_NEW", message: "Internal: stack trace", listingId: null }] });
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, readinessRoute(() => r), eligibility, profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByText(/isn.t authorised to buy for this company/)).toBeInTheDocument();
    expect(screen.getByText(/quote SOMETHING_NEW/)).toBeInTheDocument();
    expect(screen.queryByText(/stack trace/)).not.toBeInTheDocument();
  });
});

describe("BE-01 purchasing company on the cart", () => {
  const ORGB = "0b0b0b0b-0000-4000-8000-000000000001";
  const ORGC = "0c0c0c0c-0000-4000-8000-000000000002";
  const elig = (over: object = {}) => ({ method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => ({ body: { success: true, data: { buyerId: "b-1", eligible: true, verificationStatus: "VERIFIED", canPurchase: true, reason: null, organizationType: "BUSINESS", organizationId: ORGB, authorizedOrganizationIds: null, ...over } } }) });
  const prof = { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => ({ body: { success: true, data: { ...profile, organizationId: ORGB } } }) };

  it("a single-company business buyer confirms the company explicitly; the PUT carries If-Match and readiness re-runs", async () => {
    signIn();
    let org: string | null = null;
    const blocked = () => readiness({ canProceed: false, blockers: [{ code: "BUYER_ORGANIZATION_REQUIRED", message: "x", listingId: null }] });
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart({ buyerOrganizationId: org }) }) },
      readinessRoute(() => (org ? readiness({ buyerOrganizationId: org }) : blocked())),
      { method: "PUT", path: "/api/v1/buyer/cart/organization", respond: ({ body }) => ((org = (body as { organizationId: string }).organizationId), { body: cart({ buyerOrganizationId: org, rowVersion: "AAAAAAAAB9g=" }) }) },
      elig(), prof, wishIds,
    ]);
    page(<CheckoutPage />, "/checkout");
    await userEvent.click(await screen.findByRole("button", { name: /Buy for Gulf Build Contracting LLC/ }));
    const put = await waitFor(() => { const c = calls.find((x) => x.method === "PUT"); expect(c).toBeTruthy(); return c!; });
    expect(put.body).toEqual({ organizationId: ORGB });
    expect(put.headers.get("If-Match")).toBe('"AAAAAAAAB9Q="');
    expect(await screen.findByText("Gulf Build Contracting LLC", { selector: "span" })).toBeInTheDocument();
    expect(await screen.findByText(/Readiness confirmed/)).toBeInTheDocument();
    expect(screen.queryByText(/updated in another session/)).not.toBeInTheDocument(); // our own change isn't a conflict
    expect(screen.getByRole("button", { name: /Continue to payment/ })).toBeDisabled();
  });

  it("a multi-company buyer gets no preselection and sees the server's refusal", async () => {
    signIn();
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart({ buyerOrganizationId: null }) }) },
      readinessRoute(() => readiness({ canProceed: false, blockers: [{ code: "MULTIPLE_ORGANIZATIONS", message: "x", listingId: null }] })),
      { method: "PUT", path: "/api/v1/buyer/cart/organization", respond: () => ({ status: 403, body: { status: 403, code: "BUYER_ORGANIZATION_UNAUTHORIZED" } }) },
      elig({ authorizedOrganizationIds: [ORGB, ORGC] }), prof, wishIds,
    ]);
    page(<CheckoutPage />, "/checkout");
    const group = await screen.findByRole("group", { name: "Who is buying?" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(within(group).getByRole("button", { name: "Confirm" })).toBeDisabled();
    await userEvent.click(radios[1]);
    await userEvent.click(within(group).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/isn.t authorised to buy for that company/)).toBeInTheDocument();
    expect(calls.find((x) => x.method === "PUT")?.body).toEqual({ organizationId: ORGC });
  });

  it("an individual buyer buys personally with no company step", async () => {
    signIn();
    const { calls } = mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, readinessRoute(() => readiness()), elig({ organizationType: "INDIVIDUAL", organizationId: null }), profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByText(/Buying personally. No company needed/)).toBeInTheDocument();
    expect(calls.some((x) => x.method === "PUT")).toBe(false);
  });
});

describe("Stage 8C.9 seller confirmation SLA and decisions", () => {
  const future = new Date(Date.now() + 5 * 3_600_000 + 10 * 60_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();

  it("shows a countdown, an expired notice and an escalation alert from the server's deadline", async () => {
    signIn();
    mockFetch([...sessionRoutes(sellerCtx), { method: "GET", path: "/api/v1/seller/orders", respond: () => ({ body: [
      sub({ subOrderId: "11111111-0000-4000-8000-000000000001", subOrderNumber: "SO-1-S1", confirmationDeadlineUtc: future, isEscalated: false }),
      sub({ subOrderId: "11111111-0000-4000-8000-000000000002", subOrderNumber: "SO-2-S1", confirmationDeadlineUtc: past, isEscalated: false }),
      sub({ subOrderId: "11111111-0000-4000-8000-000000000003", subOrderNumber: "SO-3-S1", confirmationDeadlineUtc: past, isEscalated: true, escalatedAtUtc: past }),
      sub({ subOrderId: "11111111-0000-4000-8000-000000000004", subOrderNumber: "SO-4-S1", status: "CONFIRMED", confirmationDeadlineUtc: past }),
    ] }) }]);
    sellerPage(<SellerOrdersPage />, "/seller/orders");
    expect(await screen.findByText(/Confirm within \d+ h \d+ min/)).toBeInTheDocument();
    expect(screen.getByText(/Confirmation time has passed/)).toBeInTheDocument();
    expect(screen.getByText(/Under StockOut review/)).toBeInTheDocument();
    expect(screen.getAllByRole("status").filter((n) => /Confirm within|passed|review/.test(n.textContent ?? ""))).toHaveLength(3); // none for the confirmed one
  });

  it("confirms with the suborder's rowVersion and sellerId, then shows the server's new status", async () => {
    signIn();
    let confirmed = false;
    const { calls } = mockFetch([
      ...sessionRoutes(sellerCtx),
      { method: "GET", path: `/api/v1/seller/orders/${SO1}`, respond: () => ({ body: sub({ status: confirmed ? "CONFIRMED" : "PENDINGCONFIRMATION", confirmationDeadlineUtc: future }) }) },
      { method: "GET", path: "/api/v1/seller/orders", respond: () => ({ body: [] }) },
      { method: "POST", path: `/api/v1/seller/orders/${SO1}/confirm`, respond: () => ((confirmed = true), { body: sub({ status: "CONFIRMED", rowVersion: "AAAAAAAAB/I=" }) }) },
    ]);
    sellerPage(<SellerOrderDetailPage />, "/seller/orders/:subOrderId", `/seller/orders/${SO1}`);
    await userEvent.click(await screen.findByRole("button", { name: /Confirm order/ }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirm order" }));
    expect(await screen.findByText(/No decision needed/)).toBeInTheDocument();
    const posts = calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/confirm"));
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ expectedRowVersion: "AAAAAAAAB/E=" });
    expect(posts[0].url.searchParams.get("sellerId")).toBe(SELLER);
  });

  it("reject needs a reason; StockOut's final decision (409) is explained and the order reloads", async () => {
    signIn();
    let gets = 0;
    const { calls } = mockFetch([
      ...sessionRoutes(sellerCtx),
      { method: "GET", path: `/api/v1/seller/orders/${SO1}`, respond: () => (gets++, { body: sub({ isEscalated: true, confirmationDeadlineUtc: past }) }) },
      { method: "POST", path: `/api/v1/seller/orders/${SO1}/reject`, respond: () => ({ status: 409, body: { status: 409, code: "SUB_ORDER_FINALIZED_BY_ADMIN" } }) },
    ]);
    sellerPage(<SellerOrderDetailPage />, "/seller/orders/:subOrderId", `/seller/orders/${SO1}`);
    await userEvent.click(await screen.findByRole("button", { name: /Reject order/ }));
    const dlg = await screen.findByRole("alertdialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Reject order" }));
    expect(await within(dlg).findByText(/Tell the buyer why/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.endsWith("/reject"))).toBe(false);
    await userEvent.type(within(dlg).getByLabelText(/Reason for the buyer/), "Sold out at Jebel Ali.");
    await userEvent.click(within(dlg).getByRole("button", { name: "Reject order" }));
    expect(await screen.findByText(/StockOut has already decided this order/)).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith("/reject"))?.body).toEqual({ reason: "Sold out at Jebel Ali.", expectedRowVersion: "AAAAAAAAB/E=" });
    await waitFor(() => expect(gets).toBeGreaterThan(1));
  });

  it("buyer sees a calm delay notice when a seller is escalated", () => {
    render(
      <MemoryRouter>
        <BuyerOrderDetail order={order({ subOrders: [sub({ isEscalated: true })] })} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/taking longer than usual to confirm/)).toBeInTheDocument();
  });
});
