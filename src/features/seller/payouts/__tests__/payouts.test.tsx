import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import PayoutSettingsPage from "../payout-settings-page";
import { StripeRefreshPage, StripeReturnPage } from "../stripe-return-pages";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const SELLER = "3934b874-33be-474d-9e12-247a0290c77e";
const signIn = () => {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
};
const seller = [{ sellerId: SELLER, sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true }];
const status = (over: Record<string, unknown> = {}) => ({
  sellerOrganizationId: SELLER, stripeAccountId: null, isConnected: false, onboardingStatus: "NOT_STARTED", chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false,
  requirementsCurrentlyDue: [], requirementsEventuallyDue: [], requirementsPastDue: [], disabledReason: null, lastSyncedAtUtc: null, ...over,
});
const statusRoute = (body: unknown, code = 200) => ({ method: "GET", path: `/api/v1/seller/stripe/${SELLER}/status`, respond: () => ({ status: code, body }) });
const page = (path: string, element: React.ReactNode) =>
  renderWithApp([{ element: <RequireAuth />, children: [{ path, element }] }, { path: "/login", element: <div>login</div> }, { path: "/seller/payout-settings", element: <div>payout page</div> }], path);

describe("Seller payout account (Stripe Connect, 8B.4)", () => {
  it("NOT_STARTED: starts onboarding with this site's return/refresh URLs and leaves for the Stripe link", async () => {
    signIn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, origin: window.location.origin, href: window.location.href });
    let body: unknown = null;
    mockFetch([
      ...sessionRoutes(seller),
      statusRoute(status()),
      { method: "POST", path: `/api/v1/seller/stripe/${SELLER}/onboarding-link`, respond: ({ body: b }) => ((body = b), { body: { url: "https://connect.stripe.com/setup/e/acct_1/abc", expiresAtUtc: "2026-11-06T12:15:00Z" } }) },
    ]);
    page("/seller/payout-settings", <PayoutSettingsPage />);
    expect(await screen.findByText("No payout account connected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Set up payout account/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://connect.stripe.com/setup/e/acct_1/abc"));
    expect(body).toEqual({ returnUrl: `${window.location.origin}/seller/stripe/return`, refreshUrl: `${window.location.origin}/seller/stripe/refresh` });
  });

  it("shows the backend's redirect-origin refusal instead of falling back to another URL", async () => {
    signIn();
    const { calls } = mockFetch([
      ...sessionRoutes(seller),
      statusRoute(status()),
      { method: "POST", path: `/api/v1/seller/stripe/${SELLER}/onboarding-link`, respond: () => ({ status: 400, body: { status: 400, title: "Validation", code: "INVALID_REDIRECT_ORIGIN" } }) },
    ]);
    page("/seller/payout-settings", <PayoutSettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Set up payout account/ }));
    expect(await screen.findByText(/doesn't accept this site's address/)).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST" && c.url.pathname.includes("/seller/stripe/")).length).toBe(1);
  });

  it("RESTRICTED with requirements: lists them readably and offers Resume onboarding", async () => {
    signIn();
    mockFetch([
      ...sessionRoutes(seller),
      statusRoute(status({ isConnected: true, stripeAccountId: "acct_1", onboardingStatus: "RESTRICTED", detailsSubmitted: true, requirementsCurrentlyDue: ["individual.verification.document", "external_account"], disabledReason: "requirements.past_due", lastSyncedAtUtc: "2026-11-06T10:00:00Z" })),
    ]);
    page("/seller/payout-settings", <PayoutSettingsPage />);
    expect(await screen.findByText("Payouts restricted")).toBeInTheDocument();
    expect(screen.getByText("Identity document")).toBeInTheDocument();
    expect(screen.getByText("Bank account (IBAN) for payouts")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Resume onboarding|Update account details/ }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Payouts to bank enabled/)).toBeInTheDocument();
  });

  it("a member without payout permission sees why (403 MARKETPLACE_SELLER_ACCESS_DENIED)", async () => {
    signIn();
    mockFetch([...sessionRoutes(seller), statusRoute({ status: 403, title: "Forbidden", code: "MARKETPLACE_SELLER_ACCESS_DENIED" }, 403)]);
    page("/seller/payout-settings", <PayoutSettingsPage />);
    expect(await screen.findByText(/Only the owner or an admin/)).toBeInTheDocument();
  });

  it("return page syncs with Stripe instead of trusting the redirect", async () => {
    signIn();
    let synced = false;
    mockFetch([
      ...sessionRoutes(seller),
      { method: "POST", path: `/api/v1/seller/stripe/${SELLER}/sync`, respond: () => ((synced = true), { body: { success: true, message: "Synced", status: status({ isConnected: true, onboardingStatus: "PENDING_VERIFICATION", detailsSubmitted: true }) } }) },
    ]);
    page("/seller/stripe/return", <StripeReturnPage />);
    expect(await screen.findByText("Verification pending")).toBeInTheDocument();
    expect(synced).toBe(true);
  });

  it("refresh page requests a new link and continues to Stripe", async () => {
    signIn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, origin: window.location.origin, href: window.location.href });
    mockFetch([
      ...sessionRoutes(seller),
      { method: "POST", path: `/api/v1/seller/stripe/${SELLER}/refresh-link`, respond: () => ({ body: { url: "https://connect.stripe.com/setup/e/acct_1/new", expiresAtUtc: "2026-11-06T12:15:00Z" } }) },
    ]);
    page("/seller/stripe/refresh", <StripeRefreshPage />);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://connect.stripe.com/setup/e/acct_1/new"));
  });
});
