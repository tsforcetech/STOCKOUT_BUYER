import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router";
import { RequireAuth } from "../guards";
import { useAuth } from "../auth-context";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

function WhoAmI() {
  const { user, actor } = useAuth();
  return (
    <div>
      Hello {user?.firstName} · sellers: {actor?.sellerContexts.length ?? "?"}
    </div>
  );
}

const routes = [
  { path: "/login", element: <div>Login screen</div> },
  { path: "/", element: <div>Public home</div> },
  { element: <RequireAuth />, children: [{ path: "/account", element: <Outlet />, children: [{ index: true, element: <WhoAmI /> }] }] },
];

describe("marketplace auth", () => {
  it("lets anonymous visitors browse public pages", async () => {
    mockFetch([]);
    renderWithApp(routes, "/");
    expect(await screen.findByText("Public home")).toBeInTheDocument();
  });

  it("redirects anonymous users from account pages to /login with next", async () => {
    mockFetch([]);
    const { router } = renderWithApp(routes, "/account");
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Faccount");
  });

  it("restores the session and loads buyer/seller contexts", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    mockFetch(sessionRoutes([{ sellerId: "s-1", sellerType: "BUSINESS", displayName: "Acme", status: "ACTIVE", verificationStatus: "UNVERIFIED", onboardingStatus: "DRAFT", isOwner: true }]));
    renderWithApp(routes, "/account");
    expect(await screen.findByText(/Hello Bea · sellers: 1/)).toBeInTheDocument();
  });

  it("falls back to login when the refresh token is rejected", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-bad");
    mockFetch([{ method: "POST", path: "/api/v1/auth/token/refresh", respond: () => ({ status: 401, body: { title: "Unauthorized", status: 401 } }) }]);
    renderWithApp(routes, "/account");
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem("stockout.market.rt")).toBeNull());
  });
});
