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
import { BuyerOrderDetail, SellerSubOrderDetail } from "@/features/orders/components/order-views";
import { commerceKeys } from "@/lib/cart/server-cart";
import { ORDER_API } from "@/lib/orders/order-api";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import type { MarketplaceOrderDto } from "@/api/types/orders";

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

describe("Stage 8B.2 checkout review", () => {
  it("shows seller groups, buyer business details and API totals, and keeps Place order disabled without calling any order API", async () => {
    signIn();
    const { calls } = mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, eligibility, profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    const items = screen.getByRole("region", { name: "Items" });
    expect(within(items).getByText("Al Futtaim Engineering LLC")).toBeInTheDocument();
    expect(within(items).getByText("Apex Steel")).toBeInTheDocument();
    expect(await screen.findByText("Gulf Build Contracting LLC")).toBeInTheDocument();
    expect(screen.getByText("TRN 100234567800003")).toBeInTheDocument();
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByText("Estimated UAE VAT (7.5%)")).toBeInTheDocument(); // rate from the API, never a hardcoded 5%
    expect(within(summary).getByText(/1,075/)).toBeInTheDocument();
    expect(within(summary).getByRole("button", { name: /Place order/ })).toBeDisabled();
    expect(ORDER_API.placeOrder).toBe(false);
    // Delivery and payment are previews: choosing an option sends nothing.
    await userEvent.click(screen.getByRole("radio", { name: /Collect from seller/ }));
    await userEvent.click(screen.getByRole("tab", { name: /Bank transfer/ }));
    expect(calls.filter((c) => c.method !== "GET" && !c.url.pathname.startsWith("/api/v1/auth/"))).toEqual([]);
    expect(calls.some((c) => /\/orders|checkout/.test(c.url.pathname))).toBe(false);
  });

  it("shows readiness blockers, a missing business profile and no organisation picker", async () => {
    signIn();
    const blocked = cart({ checkoutReadiness: { canProceed: false, blockers: [{ code: "MULTIPLE_ORGANIZATIONS", message: "x", listingId: null }, { code: "INSUFFICIENT_STOCK", message: "y", listingId: L2 }] } });
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: blocked }) }, eligibility, profile404, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByText(/belongs to more than one organisation/)).toBeInTheDocument();
    expect(screen.getByText(/less stock than you asked for/)).toBeInTheDocument();
    expect(await screen.findByText("No business details on file")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("never shows internal backend reasons for an unavailable eligibility check", async () => {
    signIn();
    const internal = { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => ({ body: { success: true, data: { buyerId: "u-1", eligible: false, verificationStatus: "UNAVAILABLE", canPurchase: false, reason: "Authoritative identity service configuration (IdentityAccess:InternalUrl) is missing." } } }) };
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }, internal, profileOk, wishIds]);
    page(<CheckoutPage />, "/checkout");
    expect(await screen.findByText(/couldn't confirm your buying access/)).toBeInTheDocument();
    expect(screen.queryByText(/IdentityAccess/)).not.toBeInTheDocument();
  });

  it("tells the buyer when the cart changed in another session and reloads the review on request", async () => {
    signIn();
    let version = "AAAAAAAAB9Q=";
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart({ rowVersion: version, estimatedTotal: version === "AAAAAAAAB9Q=" ? 1075 : 2150 }) }) }, eligibility, profileOk, wishIds]);
    const { queryClient } = page(<CheckoutPage />, "/checkout");
    expect(await screen.findByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    version = "AAAAAAAAB9g=";
    await act(() => queryClient.refetchQueries({ queryKey: commerceKeys.cart }));
    expect(await screen.findByText(/Your cart was updated in another session/)).toBeInTheDocument();
    expect(screen.getByText(/1,075/)).toBeInTheDocument(); // still the reviewed figures until the buyer reloads
    await userEvent.click(screen.getByRole("button", { name: /Reload/ }));
    expect(await screen.findByText(/2,150/)).toBeInTheDocument();
    expect(screen.queryByText(/Your cart was updated in another session/)).not.toBeInTheDocument();
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

describe("Stage 8B.3 order screens (prepared, not connected)", () => {
  it("order detail route shows 'not available' and requests nothing", async () => {
    signIn();
    const { calls } = mockFetch([...sessionRoutes([]), wishIds, { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: cart() }) }]);
    page(<OrderDetailPage />, "/account/orders/:orderId", "/account/orders/7b538e12-4f11-49b8-bc79-432859b83b10");
    expect(await screen.findByText(/Order details aren.t available yet/)).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.url.pathname.includes("/orders"))).toBe(false));
    expect(Object.values(ORDER_API).every((v) => v === false)).toBe(true);
  });

  const line = { orderLineId: "ol-1", subOrderId: "so-1", listingId: L1, sellerId: "s-1", titleSnapshot: "HEB 300 Steel Beam Grade S355JR", thumbnailUrlSnapshot: null, quantity: 10, unitPrice: 250, currency: "AED", taxRatePercent: 5, taxAmount: 125, lineSubtotal: 2500, lineTotal: 2625, isWholeLot: false, minOrderQuantity: 1 };
  const sub = {
    subOrderId: "so-1", parentOrderId: "o-1", subOrderNumber: "SO-ORD-20261105-88A92F-S1", sellerOrganizationId: "org-s", sellerLegalName: "Apex Steel LLC", sellerTradingName: "Apex Steel",
    sellerTaxRegistrationNumber: null, materialSubtotal: 2500, applicableMaterialVat: 125, subOrderTotal: 2625, status: "PendingConfirmation", fulfillmentStatus: "NotStarted",
    claimStatus: "None", payoutEligibility: "NotEligible", purchasedAtUtc: null, deliveredAtUtc: null, isDeliveryProofVerified: false, deliveryProofReference: null,
    deliveryProofVerifiedBy: null, deliveryProofVerifiedAtUtc: null, holdingPeriodReferenceDateUtc: null, holdingPeriodStartDateUtc: null, holdingPeriodEndDateUtc: null,
    missingHoldingCalculationDependency: null, sellerConfirmedAtUtc: null, sellerRejectedAtUtc: null, sellerRejectionReason: null, items: [line],
  };
  const order: MarketplaceOrderDto = {
    orderId: "o-1", orderNumber: "SO-ORD-20261105-88A92F", buyerUserId: "u-1", buyerOrganizationId: "org-b", orderDateUtc: "2026-11-05T10:15:30Z", currency: "AED",
    aggregateMaterialAmount: 2500, applicableMaterialVat: 125, deliveryAmount: 0, deliveryVatAmount: 0, totalPayableAmount: 2625, status: "Draft", paymentStatus: "PendingAuthorization",
    paymentReference: null, lifecycleVersion: 1, rowVersion: "AAAAAAAAB/A=", createdAtUtc: "2026-11-05T10:15:30Z", updatedAtUtc: null, subOrders: [sub],
  };

  it("buyer order detail renders the DTO's suborders, lines and totals as given", () => {
    render(
      <MemoryRouter>
        <BuyerOrderDetail order={order} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Order SO-ORD-20261105-88A92F" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "From Apex Steel" })).toBeInTheDocument();
    expect(screen.getByText("Awaiting confirmation")).toBeInTheDocument();
    expect(screen.getByText("Payment pending")).toBeInTheDocument();
    const total = screen.getByRole("complementary", { name: "Order total" });
    expect(within(total).getByText("Total payable").nextSibling).toHaveTextContent(/2,625/);
  });

  it("seller suborder detail has confirm and reject disabled", () => {
    render(
      <MemoryRouter>
        <SellerSubOrderDetail sub={sub} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Confirm order/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Reject order/ })).toBeDisabled();
    expect(screen.getByText("Not yet eligible")).toBeInTheDocument();
  });
});
