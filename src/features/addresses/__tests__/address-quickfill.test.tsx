import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import AddressesPage from "../addresses-page";
import { pinFromNotes, placeFromNominatim, toEmirate, withMapPin } from "../geocode";
import { addressFromProfile, contactFromProfile } from "../profile-prefill";
import type { BuyerProfileDto } from "@/api/types/user-organization";

// Leaflet doesn't run in jsdom: the picker is replaced by one button that "drops a pin" at a known place.
vi.mock("../map-picker", () => ({
  default: ({ onPick }: { onPick: (p: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onPick({ lat: 25.1373328, lng: 55.228016, label: "Adonis Decor, 23 Street, Al Quoz", parts: { countryCode: "ARE", stateOrEmirate: "Dubai", city: "Dubai", area: "Al Quoz Industrial Area 1", street: "23 Street", building: "Adonis Decor" } })
      }
    >
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
const env = (data: unknown) => ({ body: { success: true, data } });
const PROFILE = {
  organizationId: ORG, organizationType: "BUSINESS", legalName: "Sharaco Trading LLC", tradingName: "Sharaco", signatoryName: "Hakeem Ali", signatoryPhone: "+971 50 111 2222",
  businessContactPhone: "+971 4 333 4444", addressLine1: "Office 12, Al Garhoud Road", addressLine2: "Al Garhoud", city: "Dubai", stateOrEmirate: "Dubai Emirate", postalCode: null, countryCode: "AE",
  fullName: "Hakeem Ali", mobileNumber: "+971 50 111 2222", residentialAddress: null,
} as unknown as BuyerProfileDto;
const saved = (body: object) => ({ addressId: "a1000000-0000-4000-8000-000000000009", ownerOrganizationId: ORG, isDefault: true, status: "ACTIVE", version: 1, createdAtUtc: "", updatedAtUtc: "", deactivatedAtUtc: null, rowVersion: "AAAAAAAAAQE=", ...body });

function setup() {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
  let body: Record<string, unknown> | null = null;
  const { calls } = mockFetch([
    ...sessionRoutes([]),
    { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => env({ buyerId: "b-1", eligible: true, verificationStatus: "VERIFIED", canPurchase: true, reason: null, organizationType: "BUSINESS", organizationId: ORG, authorizedOrganizationIds: null }) },
    { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: { cartId: "c", buyerId: "u-1", itemCount: 0, totalQuantity: 0, totalSubtotal: 0, estimatedVatRatePercent: 5, estimatedVatAmount: 0, estimatedTotal: 0, currency: "AED", rowVersion: "AAAAAAAAB9Q=", updatedAt: "", sellerGroups: [], checkoutReadiness: { canProceed: false, blockers: [] }, buyerOrganizationId: null } }) },
    { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env(PROFILE) },
    { method: "GET", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses`, respond: () => env({ items: [], page: 1, pageSize: 20, totalCount: 0 }) },
    { method: "POST", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses`, respond: (req) => ((body = req.body as Record<string, unknown>), { status: 201, body: { success: true, data: saved(body) } }) },
  ]);
  renderWithApp([{ element: <RequireAuth />, children: [{ path: "/account/addresses", element: <AddressesPage /> }] }, { path: "/login", element: <div>login</div> }], "/account/addresses");
  return { calls, posted: () => body };
}

describe("address form quick fill", () => {
  it("starts with the buyer's name and phone, and fills the company address in one click", async () => {
    const { posted } = setup();
    await userEvent.click(await screen.findByRole("button", { name: /Add your first address/ }));
    const dlg = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dlg).getByLabelText(/Contact name/)).toHaveValue("Hakeem Ali"));
    expect(within(dlg).getByLabelText(/Contact phone/)).toHaveValue("+971 4 333 4444");

    await userEvent.click(within(dlg).getByRole("button", { name: /Use my company address/ }));
    expect(within(dlg).getByLabelText(/Address name/)).toHaveValue("Sharaco office");
    expect(within(dlg).getByLabelText(/^Street/)).toHaveValue("Office 12, Al Garhoud Road");
    expect(within(dlg).getByLabelText(/^Area/)).toHaveValue("Al Garhoud");
    expect(within(dlg).getByRole("combobox", { name: /Emirate/ })).toHaveTextContent("Dubai");
    expect(within(dlg).getByText(/Filled from your verified details/)).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole("button", { name: /Pick on map/ }));
    await userEvent.click(await within(dlg).findByRole("button", { name: "Drop test pin" }));
    await userEvent.clear(within(dlg).getByLabelText(/^Street/));
    await userEvent.type(within(dlg).getByLabelText(/^Street/), "Office 12, Al Garhoud Road");
    await userEvent.clear(within(dlg).getByLabelText(/^Area/));
    await userEvent.type(within(dlg).getByLabelText(/^Area/), "Al Garhoud");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save address" }));
    await waitFor(() => expect(posted()).not.toBeNull());
    expect(posted()).toMatchObject({ label: "Sharaco office", contactName: "Hakeem Ali", contactPhone: "+971 4 333 4444", countryCode: "ARE", stateOrEmirate: "Dubai", city: "Dubai", area: "Al Garhoud", street: "Office 12, Al Garhoud Road" });
  });

  it("fills the address from a map pin and sends it as coordinates", async () => {
    const { posted } = setup();
    await userEvent.click(await screen.findByRole("button", { name: /Add your first address/ }));
    const dlg = await screen.findByRole("dialog");
    await userEvent.type(within(dlg).getByLabelText(/Notes for the driver/), "Call before unloading");
    await userEvent.click(within(dlg).getByRole("button", { name: /Pick on map/ }));
    await userEvent.click(await within(dlg).findByRole("button", { name: "Drop test pin" }));

    expect(within(dlg).getByLabelText(/^Area/)).toHaveValue("Al Quoz Industrial Area 1");
    expect(within(dlg).getByLabelText(/^Street/)).toHaveValue("23 Street");
    expect(within(dlg).getByLabelText(/^Building/)).toHaveValue("Adonis Decor");
    expect(within(dlg).getByText(/Map pin set \(25.13733, 55.22802\)/)).toBeInTheDocument();
    expect(within(dlg).getByRole("link", { name: "View" })).toHaveAttribute("href", "https://maps.google.com/?q=25.137333,55.228016");

    await userEvent.type(within(dlg).getByLabelText(/Address name/), "Al Quoz site");
    await userEvent.click(within(dlg).getByRole("button", { name: "Save address" }));
    await waitFor(() => expect(posted()).not.toBeNull());
    // BE-13: the pin is sent as coordinates (6 decimals), no longer written into the driver notes.
    expect(posted()).toMatchObject({ deliveryNotes: "Call before unloading", latitude: 25.137333, longitude: 55.228016, mapFormattedAddress: "Adonis Decor, 23 Street, Al Quoz" });
  });
});

describe("legacy addresses without coordinates", () => {
  it("shows Map pin missing, and moves a pin kept in the notes into the coordinates on edit (If-Match)", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    localStorage.setItem("stockout.market.rt", "rt-1");
    const legacy = saved({ label: "Old site", contactName: "Desk", contactPhone: "+971501234567", siteName: null, siteContactName: null, siteContactPhone: null, countryCode: "ARE", stateOrEmirate: "Dubai", city: "Dubai", area: "Al Quoz", street: "Street 1", building: null, unit: null, postalCode: null, deliveryNotes: "Gate 3\nMap pin: https://maps.google.com/?q=25.100000,55.200000", latitude: null, longitude: null, mapPlaceId: null, mapFormattedAddress: null });
    let put: { body: unknown; ifMatch: string | null } | null = null;
    mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => env({ buyerId: "b-1", eligible: true, verificationStatus: "VERIFIED", canPurchase: true, reason: null, organizationType: "BUSINESS", organizationId: ORG, authorizedOrganizationIds: null }) },
      { method: "GET", path: "/api/v1/buyer/cart", respond: () => ({ body: { cartId: "c", buyerId: "u-1", itemCount: 0, totalQuantity: 0, totalSubtotal: 0, estimatedVatRatePercent: 5, estimatedVatAmount: 0, estimatedTotal: 0, currency: "AED", rowVersion: "AAAAAAAAB9Q=", updatedAt: "", sellerGroups: [], checkoutReadiness: { canProceed: false, blockers: [] }, buyerOrganizationId: null } }) },
      { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env(PROFILE) },
      { method: "GET", path: `/api/v1/marketplace/buyer/organizations/${ORG}/addresses`, respond: () => env({ items: [legacy], page: 1, pageSize: 20, totalCount: 1 }) },
      { method: "PUT", path: /\/addresses\/[^/]+$/, respond: (req) => ((put = { body: req.body, ifMatch: new Headers(req.init.headers).get("If-Match") }), env({ ...legacy, latitude: 25.1, longitude: 55.2 })) },
    ]);
    renderWithApp([{ element: <RequireAuth />, children: [{ path: "/account/addresses", element: <AddressesPage /> }] }, { path: "/login", element: <div>login</div> }], "/account/addresses");
    expect(await screen.findByText("Map pin missing")).toBeInTheDocument();
    // Handoff §6.2: legacy addresses get an "Add delivery pin" remediation that opens the address for editing.
    await userEvent.click(screen.getByRole("button", { name: /Add delivery pin/ }));
    const dlg = await screen.findByRole("dialog", { name: "Edit address" });
    expect(within(dlg).getByText(/from your notes/)).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(put).not.toBeNull());
    expect(put!.ifMatch).toBe('"AAAAAAAAAQE="');
    expect(put!.body).toMatchObject({ latitude: 25.1, longitude: 55.2, deliveryNotes: "Gate 3" });
  });
});

describe("map and profile helpers", () => {
  it("maps an OpenStreetMap result to our fields", () => {
    const p = placeFromNominatim({
      lat: "25.1373328", lon: "55.2280160", name: "Adonis Decor", display_name: "Adonis Decor, 23 Street, …",
      address: { office: "Adonis Decor", road: "23 Street", industrial: "Al Quoz Industrial Area", neighbourhood: "Al Quoz Industrial Area 1", suburb: "Al Quoz Community", city: "Dubai", "ISO3166-2-lvl4": "AE-DU", state: "Dubai Emirate", country_code: "ae" },
    });
    expect(p.parts).toEqual({ countryCode: "ARE", stateOrEmirate: "Dubai", city: "Dubai", area: "Al Quoz Industrial Area 1", street: "23 Street", building: "Adonis Decor" });
  });

  it.each([["Dubai Emirate", "Dubai"], ["Emirate of Sharjah", "Sharjah"], ["RAK", "Ras Al Khaimah"], ["umm al quwain", "Umm Al Quwain"], ["Muscat", null]])("toEmirate(%j) → %j", (v, e) => expect(toEmirate(v)).toBe(e));

  it("keeps one pin line in the notes and reads it back", () => {
    const once = withMapPin("Gate 3", { lat: 25.1, lng: 55.2 });
    const twice = withMapPin(once, { lat: 24.5, lng: 54.4 });
    expect(twice).toBe("Gate 3\nMap pin: https://maps.google.com/?q=24.500000,54.400000");
    expect(pinFromNotes(twice)).toEqual({ lat: 24.5, lng: 54.4 });
    expect(withMapPin(twice, null)).toBe("Gate 3");
  });

  it("prefers the business phone and the signatory name", () => {
    expect(contactFromProfile(PROFILE)).toEqual({ contactName: "Hakeem Ali", contactPhone: "+971 4 333 4444" });
    expect(addressFromProfile(PROFILE)).toMatchObject({ countryCode: "ARE", stateOrEmirate: "Dubai", summary: "Office 12, Al Garhoud Road, Al Garhoud, Dubai" });
    expect(addressFromProfile({ ...PROFILE, addressLine1: null, city: null } as BuyerProfileDto)).toBeNull();
  });
});
