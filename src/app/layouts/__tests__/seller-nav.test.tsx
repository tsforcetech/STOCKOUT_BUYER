import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import { SellerLayout } from "../seller-layout";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const SELLER = "3934b874-33be-474d-9e12-247a0290c77e";
const seller = [{ sellerId: SELLER, sellerType: "BUSINESS", displayName: "Sharaco", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true }];
const signIn = () => {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
};
const routes = (path: string) =>
  renderWithApp(
    [
      { element: <RequireAuth />, children: [{ path: "/seller", element: <SellerLayout />, children: [{ path: "listings", element: <p>listings page</p> }, { path: "corrections", element: <p>proposals page</p> }, { path: "team", element: <p>team page</p> }] }] },
      { path: "/login", element: <div>login</div> },
    ],
    path,
  );
const api = (stripe = "NOT_STARTED") => [
  ...sessionRoutes(seller),
  { method: "GET", path: `/api/v1/marketplace/sellers/${SELLER}/listings/corrections`, respond: () => ({ body: { items: [{}, {}], totalCount: 2, page: 1, pageSize: 100 } }) },
  { method: "GET", path: `/api/v1/seller/stripe/${SELLER}/status`, respond: () => ({ body: { sellerOrganizationId: SELLER, onboardingStatus: stripe, isConnected: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, requirementsCurrentlyDue: [], requirementsEventuallyDue: [], requirementsPastDue: [], stripeAccountId: null, disabledReason: null, lastSyncedAtUtc: null } }) },
];

describe("Seller menu (grouped, 6 items)", () => {
  it("shows three groups with six items (no Add listing button), account items moved out, and badges", async () => {
    signIn();
    mockFetch(api());
    routes("/seller/listings");
    const nav = await screen.findByRole("navigation", { name: "Seller" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent?.replace(/\d+$/, "").replace(/Soon$/, "").trim())).toEqual(["Home", "Listings", "All listings", "Needs action", "Bulk upload", "Orders", "Payouts", "Business profile"]);
    for (const g of ["Sell", "Orders & money", "Business"]) expect(within(nav).getByText(g)).toBeInTheDocument();
    expect(within(nav).queryByText("My profile")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Bulk import")).not.toBeInTheDocument();
    expect(await within(nav).findByLabelText("2 need your action")).toBeInTheDocument();
    expect(await within(nav).findByLabelText("Needs setting up")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "All listings" })).toHaveAttribute("aria-current", "page");
  });

  it("Listings opens to show its child pages; Business profile stays closed until clicked", async () => {
    signIn();
    mockFetch(api("COMPLETED"));
    routes("/seller/corrections");
    const nav = await screen.findByRole("navigation", { name: "Seller" });
    const children = await within(nav).findByRole("list", { name: "Listings pages" });
    expect(within(children).getAllByRole("link").map((a) => a.textContent?.replace(/\d+$/, ""))).toEqual(["All listings", "Needs action", "Bulk upload"]);
    expect(within(children).getByRole("link", { name: /Needs action/ })).toHaveAttribute("aria-current", "page");
    expect(within(children).getByRole("link", { name: "Bulk upload" })).toHaveAttribute("href", "/seller/listings/import");
    expect(within(nav).queryByRole("list", { name: "Business profile pages" })).not.toBeInTheDocument();
    // Clicking the open parent folds it.
    await userEvent.click(within(nav).getByRole("link", { name: /^Listings/ }));
    expect(within(nav).queryByRole("list", { name: "Listings pages" })).not.toBeInTheDocument();
    // No page tabs any more.
    expect(screen.queryByRole("navigation", { name: "Listings sections" })).not.toBeInTheDocument();
  });
});
