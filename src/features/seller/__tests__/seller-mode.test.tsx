import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const sellerCtx = { sellerId: "11111111-1111-1111-1111-111111111111", sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "UNVERIFIED", onboardingStatus: "DRAFT", isOwner: true };
const sellerDto = {
  ...sellerCtx,
  organizationType: "BUSINESS",
  email: "",
  legalName: "Acme Surplus LLC",
  registrationNo: null,
  countryCode: "AE",
  defaultCurrency: "AED",
  profileLogoAssetId: null,
  submittedAtUtc: null,
  verifiedAtUtc: null,
  rejectedAtUtc: null,
  suspendedAtUtc: null,
  createdAtUtc: "2026-10-17T10:00:00",
  updatedAtUtc: "2026-10-17T10:00:00",
  rowVersion: "AAAAAAAAB9E=",
};

describe("seller mode", () => {
  it("sends a signed-in buyer without a seller account to onboarding", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    mockFetch([...sessionRoutes([]), { method: "GET", path: /\/api\/v1\/catalog\/categories$/, respond: () => ({ body: { success: true, data: [] } }) }]);
    const { router } = renderWithApp(routes, "/seller");
    await waitFor(() => expect(router.state.location.pathname).toBe("/seller/onboarding"));
    expect(await screen.findByRole("button", { name: "Create seller account" })).toBeInTheDocument();
  });

  it("creates a business seller account and enters the seller portal", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    let created = false;
    const { calls } = mockFetch([
      ...sessionRoutes([]).filter((r) => r.path !== "/api/v1/marketplace/actors/me"),
      {
        method: "GET",
        path: "/api/v1/marketplace/actors/me",
        respond: () => ({ body: { success: true, data: { userId: "u-1", buyer: { enabled: true }, sellerContexts: created ? [sellerCtx] : [] } } }),
      },
      {
        method: "POST",
        path: "/api/v1/marketplace/sellers",
        respond: () => {
          created = true;
          return { body: { success: true, data: sellerDto } };
        },
      },
      { method: "GET", path: /\/api\/v1\/marketplace\/sellers\/[^/]+$/, respond: () => ({ body: { success: true, data: sellerDto } }) },
      { method: "GET", path: /\/documents$/, respond: () => ({ body: { success: true, data: [] } }) },
      { method: "GET", path: /\/listings$/, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) },
      { method: "GET", path: /\/api\/v1\/catalog\/categories$/, respond: () => ({ body: { success: true, data: [] } }) },
    ]);
    const { router } = renderWithApp(routes, "/seller/onboarding");
    await userEvent.type(await screen.findByLabelText(/Display name/), "Acme Surplus");
    await userEvent.type(screen.getByLabelText(/Legal name/), "Acme Surplus LLC");
    const country = screen.getByLabelText(/Country code/);
    await userEvent.clear(country);
    await userEvent.type(country, "ae");
    const currency = screen.getByLabelText(/Default currency/);
    await userEvent.clear(currency);
    await userEvent.type(currency, "aed");
    await userEvent.click(screen.getByRole("button", { name: "Create seller account" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url.pathname === "/api/v1/marketplace/sellers")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.url.pathname === "/api/v1/marketplace/sellers")?.body).toMatchObject({
      sellerType: "BUSINESS",
      displayName: "Acme Surplus",
      legalName: "Acme Surplus LLC",
      countryCode: "AE",
      defaultCurrency: "AED",
    });
    await waitFor(() => expect(router.state.location.pathname.startsWith("/seller")).toBe(true));
    await waitFor(() => expect(router.state.location.pathname).not.toBe("/seller/onboarding"));
  });
});
