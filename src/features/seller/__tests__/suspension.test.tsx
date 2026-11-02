import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { ListingAccessNotice } from "../components/listing-access-notice";
import type { SellerContextResponse } from "@/api/types/user-organization";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

const ctx = (status: string) => ({ sellerId: "s-1", sellerType: "BUSINESS", displayName: "UAT Seller", status, verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true });

/** Renders the notice for whatever the live actor context currently says. */
function Probe() {
  const { actor } = useAuth();
  const seller = actor?.sellerContexts[0] as SellerContextResponse | undefined;
  if (!seller) return null;
  return (
    <>
      <p>status: {seller.status}</p>
      <ListingAccessNotice seller={seller} />
    </>
  );
}

describe("A5-R1 seller portal: suspended account", () => {
  it("explains the suspension and unlocks after reinstatement without a reload", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    localStorage.setItem("stockout.market.rt", "rt-1");
    let status = "SUSPENDED";
    const routes = sessionRoutes([]).map((r) =>
      r.path === "/api/v1/marketplace/actors/me" ? { ...r, respond: () => ({ body: { success: true, data: { userId: "u-1", buyer: { enabled: true }, sellerContexts: [ctx(status)] } } }) } : r,
    );
    mockFetch([...routes, { method: "GET", path: /\/eligibility$/, respond: () => ({ body: { success: true, data: { sellerId: "s-1", canList: true, reasons: [] } } }) }]);
    const user = userEvent.setup();
    renderWithApp([{ element: <RequireAuth />, children: [{ path: "/", element: <Probe /> }] }, { path: "/login", element: <div>login</div> }], "/");
    expect(await screen.findByText("Your seller account is suspended")).toBeInTheDocument();

    status = "ACTIVE"; // an admin reinstates the seller
    await user.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(screen.getByText("status: ACTIVE")).toBeInTheDocument());
    expect(screen.queryByText("Your seller account is suspended")).not.toBeInTheDocument();
  });
});
