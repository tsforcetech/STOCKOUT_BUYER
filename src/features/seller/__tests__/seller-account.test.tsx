import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const sellerCtx = { sellerId: "11111111-1111-1111-1111-111111111111", sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true };

describe("seller portal account", () => {
  it("opens the profile inside the portal and signs out from the account menu", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    mockFetch([
      ...sessionRoutes([]).filter((r) => r.path !== "/api/v1/marketplace/actors/me"),
      { method: "GET", path: "/api/v1/marketplace/actors/me", respond: () => ({ body: { success: true, data: { userId: "u-1", buyer: { enabled: true }, sellerContexts: [sellerCtx] } } }) },
      { method: "POST", path: /\/api\/v1\/(auth|identity)\/.*/, respond: () => ({ status: 204 }) },
      { method: "DELETE", path: /\/api\/v1\/identity\/.*/, respond: () => ({ status: 204 }) },
      { method: "GET", path: /.*/, respond: () => ({ body: { success: true, data: [] } }) },
    ]);
    const { router } = renderWithApp(routes, "/seller/profile");
    expect(await screen.findByRole("heading", { name: "Profile", level: 1 })).toBeInTheDocument();
    // Still inside the seller portal: its sidebar is there, and the tabs stay in the portal.
    expect(screen.getByRole("navigation", { name: "Seller" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Account sections" })).getByRole("link", { name: "Security" })).toHaveAttribute("href", "/seller/security");

    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const menu = await screen.findByRole("dialog");
    await userEvent.click(within(menu).getByRole("button", { name: /Sign out/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(sessionStorage.getItem("stockout.market.rt")).toBeNull();
  });
});
