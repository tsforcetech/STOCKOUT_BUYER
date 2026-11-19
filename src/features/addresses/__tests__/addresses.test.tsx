import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import AddressesPage from "../addresses-page";
import { CheckoutAddressPicker } from "../checkout-address-picker";
import { validateAddress } from "../address-form";
import { isAuthorizedAndHeld, shouldKeepPolling } from "@/lib/orders/payment-preauth";

// Leaflet doesn't run in jsdom: one button drops a pin without filling any field.
vi.mock("../map-picker", () => ({
  default: ({ onPick }: { onPick: (p: unknown) => void }) => (
    <button type="button" onClick={() => onPick({ lat: 25.2048123456, lng: 55.2708, label: "Al Quoz, Dubai", parts: {} })}>
      Drop test pin
    </button>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const ORG = "3934b874-33be-474d-9e12-247a0290c77e";
const signIn = () => {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
};
const env = (data: unknown) => ({ body: { success: true, data } });
const elig = (over: object = {}) => ({ method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => env({ buyerId: "b-1", eligible: true, verificationStatus: "VERIFIED", canPurchase: true, reason: null, organizationType: "INDIVIDUAL", organizationId: null, authorizedOrganizationIds: null, ...over }) });
const cartRoute = { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: { cartId: "c", buyerId: "u-1", itemCount: 0, totalQuantity: 0, totalSubtotal: 0, estimatedVatRatePercent: 5, estimatedVatAmount: 0, estimatedTotal: 0, currency: "AED", rowVersion: "AAAAAAAAB9Q=", updatedAt: "", sellerGroups: [], checkoutReadiness: { canProceed: false, blockers: [] }, buyerOrganizationId: null } }) };
const profileRoute = { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env({ organizationId: ORG, legalName: "Sharaco Trading LLC", tradingName: "Sharaco" }) };
const addr = (over: object = {}) => ({
  addressId: "a1000000-0000-4000-8000-000000000001", ownerOrganizationId: ORG, label: "Dubai warehouse", contactName: "Receiving desk", contactPhone: "+971501234567",
  siteName: null, siteContactName: null, siteContactPhone: null, countryCode: "ARE", stateOrEmirate: "Dubai", city: "Dubai", area: "Al Quoz", street: "Street 12",
  building: "Warehouse 2", unit: null, postalCode: null, deliveryNotes: null, isDefault: false, status: "ACTIVE", version: 1, createdAtUtc: "2026-11-16T08:00:00",
  updatedAtUtc: "2026-11-16T08:00:00", deactivatedAtUtc: null, rowVersion: "AAAAAAAAAQE=", ...over,
});
const page = () => renderWithApp([{ element: <RequireAuth />, children: [{ path: "/account/addresses", element: <AddressesPage /> }] }, { path: "/login", element: <div>login</div> }], "/account/addresses");

async function fillForm() {
  const dlg = await screen.findByRole("dialog");
  await userEvent.type(within(dlg).getByLabelText(/Address name/), "Dubai warehouse");
  await userEvent.type(within(dlg).getByLabelText(/Contact name/), "Receiving desk");
  await userEvent.type(within(dlg).getByLabelText(/Contact phone/), "+971 50 123 4567");
  await userEvent.click(within(dlg).getByRole("combobox", { name: /Emirate/ }));
  await userEvent.click(await screen.findByRole("option", { name: "Dubai" }));
  await userEvent.type(within(dlg).getByLabelText(/^City/), "Dubai");
  await userEvent.type(within(dlg).getByLabelText(/^Area/), "Al Quoz");
  await userEvent.type(within(dlg).getByLabelText(/^Street/), "Street 12");
  return dlg;
}

describe("COM-ADDR-01 address book", () => {
  it("individual buyer: empty book, client validation, then the first address is created as default with an Idempotency-Key that survives a retry", async () => {
    signIn();
    let attempts = 0;
    const { calls } = mockFetch([
      ...sessionRoutes([]), elig(), cartRoute, profileRoute,
      { method: "GET", path: "/api/v1/marketplace/buyer/addresses", respond: () => env({ items: attempts >= 2 ? [addr({ isDefault: true })] : [], page: 1, pageSize: 20, totalCount: attempts >= 2 ? 1 : 0 }) },
      { method: "POST", path: "/api/v1/marketplace/buyer/addresses", respond: () => (++attempts === 1 ? { status: 409, body: { status: 409, code: "BUYER_ADDRESS_BUSY" } } : { status: 201, body: { success: true, data: addr({ isDefault: true }) } }) },
    ]);
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Add your first address/ }));
    const dlg = await screen.findByRole("dialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save address" }));
    expect(within(dlg).getByText("Choose an emirate.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.url.pathname.endsWith("/addresses"))).toBe(false);
    await fillForm();
    await userEvent.click(within(dlg).getByRole("button", { name: "Save address" }));
    // BE-13: a new address needs its map pin; the map opens for it and nothing is sent.
    expect(await within(dlg).findByText("Drop a pin on the map where the delivery should arrive.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.url.pathname.endsWith("/addresses"))).toBe(false);
    await userEvent.click(await within(dlg).findByRole("button", { name: "Drop test pin" }));
    await userEvent.click(within(dlg).getByRole("button", { name: "Save address" }));
    expect(await within(dlg).findByText(/still saving your last change/)).toBeInTheDocument();
    expect(within(dlg).getByLabelText(/Address name/)).toHaveValue("Dubai warehouse"); // nothing lost
    await userEvent.click(within(dlg).getByRole("button", { name: "Save address" }));
    expect(await screen.findByText(/"Dubai warehouse" was added/)).toBeInTheDocument();
    const posts = calls.filter((c) => c.method === "POST" && c.url.pathname === "/api/v1/marketplace/buyer/addresses");
    expect(posts).toHaveLength(2);
    expect(posts[0].headers.get("Idempotency-Key")).toBeTruthy();
    expect(posts[1].headers.get("Idempotency-Key")).toBe(posts[0].headers.get("Idempotency-Key")); // same body → same key
    expect(posts[0].body).toMatchObject({ label: "Dubai warehouse", contactPhone: "+971 50 123 4567", countryCode: "ARE", stateOrEmirate: "Dubai", street: "Street 12", building: null, isDefault: true, latitude: 25.204812, longitude: 55.2708, mapFormattedAddress: "Al Quoz, Dubai", mapPlaceId: null });
  });

  it("business buyer: uses the company's book, default first, make default and remove (with If-Match)", async () => {
    signIn();
    const B = "a1000000-0000-4000-8000-000000000002";
    const { calls } = mockFetch([
      ...sessionRoutes([]), elig({ organizationType: "BUSINESS", organizationId: ORG }), cartRoute, profileRoute,
      { method: "GET", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses`, respond: () => env({ items: [addr({ addressId: B, label: "Head office", isDefault: false, rowVersion: "AAAAAAAAAQI=" }), addr({ isDefault: true })], page: 1, pageSize: 20, totalCount: 2 }) },
      { method: "POST", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses/${B}/default`, respond: () => env(addr({ addressId: B, isDefault: true })) },
      { method: "DELETE", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses/${B}`, respond: () => env(addr({ addressId: B, status: "INACTIVE" })) },
    ]);
    page();
    const cards = await screen.findAllByRole("listitem");
    expect(within(cards[0]).getByText("Dubai warehouse")).toBeInTheDocument(); // default first
    expect(within(cards[0]).getByText("Default")).toBeInTheDocument();
    await userEvent.click(within(cards[1]).getByRole("button", { name: /Make default/ }));
    expect(await screen.findByText(/"Head office" is now your default/)).toBeInTheDocument();
    await userEvent.click(within(cards[1]).getByRole("button", { name: /Remove/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove address" }));
    await waitFor(() => expect(calls.find((c) => c.method === "DELETE")?.headers.get("If-Match")).toBe('"AAAAAAAAAQI="'));
    expect(calls.some((c) => c.url.pathname === "/api/v1/marketplace/buyer/addresses")).toBe(false); // never the personal book
  });

  it("edit sends If-Match; a version conflict loads the latest address into the form", async () => {
    signIn();
    let v = 1;
    const { calls } = mockFetch([
      ...sessionRoutes([]), elig(), cartRoute, profileRoute,
      { method: "GET", path: "/api/v1/marketplace/buyer/addresses", respond: () => env({ items: [addr({ isDefault: true })], page: 1, pageSize: 20, totalCount: 1 }) },
      { method: "GET", path: "/api/v1/marketplace/buyer/addresses/a1000000-0000-4000-8000-000000000001", respond: () => env(addr({ isDefault: true, label: "Dubai warehouse (moved)", rowVersion: "AAAAAAAAAQ8=" })) },
      { method: "PUT", path: "/api/v1/marketplace/buyer/addresses/a1000000-0000-4000-8000-000000000001", respond: () => (v++ === 1 ? { status: 409, body: { status: 409, code: "BUYER_ADDRESS_VERSION_CONFLICT" } } : env(addr())) },
    ]);
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    const dlg = await screen.findByRole("dialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save changes" }));
    expect(await within(dlg).findByText(/changed somewhere else/)).toBeInTheDocument();
    await waitFor(() => expect(within(dlg).getByLabelText(/Address name/)).toHaveValue("Dubai warehouse (moved)"));
    await userEvent.click(within(dlg).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2));
    const all = calls.filter((c) => c.method === "PUT");
    expect(all[0].headers.get("If-Match")).toBe('"AAAAAAAAAQE="');
    expect(all[1].headers.get("If-Match")).toBe('"AAAAAAAAAQ8="');
  });

  it("a role without access sees the server's permission message", async () => {
    signIn();
    mockFetch([
      ...sessionRoutes([]), elig({ organizationType: "BUSINESS", organizationId: ORG }), cartRoute, profileRoute,
      { method: "GET", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses`, respond: () => ({ status: 403, body: { status: 403, code: "BUYER_ADDRESS_ACCESS_DENIED" } }) },
    ]);
    page();
    expect(await screen.findByText(/don.t have access to these addresses/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add address/ })).not.toBeInTheDocument();
  });

  it("checkout picker preselects the default and lists only active addresses", async () => {
    signIn();
    mockFetch([...sessionRoutes([]), { method: "GET", path: "/api/v1/marketplace/buyer/addresses", respond: () => env({ items: [addr({ addressId: "x2", label: "Site B" }), addr({ isDefault: true }), addr({ addressId: "x3", label: "Old", status: "INACTIVE" })], page: 1, pageSize: 20, totalCount: 3 }) }]);
    renderWithApp([{ path: "/checkout", element: <CheckoutAddressPicker owner={{ kind: "individual" }} /> }], "/checkout");
    const radios = await screen.findAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /Dubai warehouse/ })).toBeChecked();
    expect(screen.queryByText("Old")).not.toBeInTheDocument();
    expect(screen.getAllByText("Receiving desk · +971501234567")).toHaveLength(2); // contact on each card
    await userEvent.click(screen.getByRole("button", { name: "Add a new address" }));
    expect(await screen.findByRole("dialog", { name: "Add a delivery address" })).toBeInTheDocument(); // added right at checkout
  });

  it("checkout picker offers Add delivery pin on an address without coordinates", async () => {
    signIn();
    mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/marketplace/buyer/addresses", respond: () => env({ items: [addr({ isDefault: true, latitude: null, longitude: null }), addr({ addressId: "x2", label: "Site B", latitude: 25.1, longitude: 55.2 })], page: 1, pageSize: 20, totalCount: 2 }) },
    ]);
    renderWithApp([{ path: "/checkout", element: <CheckoutAddressPicker owner={{ kind: "individual" }} /> }], "/checkout");
    expect(await screen.findByText("Map pin missing")).toBeInTheDocument();
    const fix = screen.getAllByRole("button", { name: /Add delivery pin/ });
    expect(fix).toHaveLength(1);
    await userEvent.click(fix[0]);
    expect(await screen.findByRole("dialog", { name: "Edit address" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Dubai warehouse/, hidden: true })).toBeChecked(); // the button doesn't change the selection
  });
});

describe("address validation and 8C.10 helpers", () => {
  it("requires a street or building, a valid phone and a canonical emirate", () => {
    const base = { label: "x", contactName: "y", contactPhone: "12", siteName: "", siteContactName: "", siteContactPhone: "", countryCode: "ARE", stateOrEmirate: "Dubaii", city: "Dubai", area: "A", street: "", building: "", unit: "", postalCode: "", deliveryNotes: "", isDefault: false };
    const e = validateAddress(base);
    expect(e.contactPhone).toMatch(/valid phone/);
    expect(e.stateOrEmirate).toMatch(/seven emirates/);
    expect(e.line).toMatch(/street or a building/);
  });

  it("only AUTHORIZED + provider-verified + every line HELD_POST_AUTH counts as authorised; polling stops by 120 s", () => {
    const held = { reservationStatus: "HELD_POST_AUTH" } as never;
    expect(isAuthorizedAndHeld({ internalStatus: "AUTHORIZED", isProviderVerified: true, reservationStatus: "HELD_POST_AUTH", reservations: [held] })).toBe(true);
    expect(isAuthorizedAndHeld({ internalStatus: "AUTHORIZED", isProviderVerified: false, reservationStatus: "HELD_POST_AUTH", reservations: [held] })).toBe(false);
    const t0 = 1_000_000;
    const s = { shouldContinueActivePolling: true, pollingWindowExpiresAtUtc: null, maxActivePollingDurationSeconds: 120 };
    expect(shouldKeepPolling(s, t0, t0 + 60_000)).toBe(true);
    expect(shouldKeepPolling(s, t0, t0 + 121_000)).toBe(false);
    expect(shouldKeepPolling({ ...s, shouldContinueActivePolling: false }, t0, t0 + 1_000)).toBe(false);
  });
});
