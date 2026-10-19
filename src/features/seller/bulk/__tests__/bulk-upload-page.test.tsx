import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const SELLER = "11111111-1111-1111-1111-111111111111";
const sellerCtx = { sellerId: SELLER, sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "APPROVED", isOwner: true };
const sellerDto = { ...sellerCtx, organizationType: "BUSINESS", email: "", legalName: "Acme", registrationNo: null, countryCode: "AE", defaultCurrency: "AED", profileLogoAssetId: null, rowVersion: "AAAAAAAAB9E=" };

const tree = [
  {
    categoryId: "c-elec",
    slug: "electrical",
    parentCategoryId: null,
    name: "Electrical",
    children: [{ categoryId: "c-switch", slug: "switchgear", parentCategoryId: "c-elec", name: "Switchgear", children: [] }],
  },
];
const requirements = {
  categoryId: "c-switch",
  attributes: [],
  brands: [],
  unitRules: {
    categoryId: "c-switch",
    defaultUnitId: "u-pcs",
    units: [{ unitId: "u-pcs", code: "PCS", name: "Pieces", symbol: "pcs", unitType: "COUNT", minQuantity: null, maxQuantity: null, quantityDecimalPrecision: 0, isInherited: false, sourceCategoryId: "c-switch" }],
  },
  conditionRules: { categoryId: "c-switch", isConditionRequired: false, conditions: [{ conditionId: "k-new", code: "NEW", name: "New", isInherited: false, isGradeRequired: false, grades: [] }] },
};

function setup() {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  let created = 0;
  const http = mockFetch([
    ...sessionRoutes([sellerCtx]),
    { method: "GET", path: `/api/v1/marketplace/sellers/${SELLER}`, respond: () => ({ body: { success: true, data: sellerDto } }) },
    { method: "GET", path: "/api/v1/catalog/categories", respond: () => ({ body: { success: true, data: tree } }) },
    { method: "GET", path: "/api/v1/catalog/categories/c-switch/listing-requirements", respond: () => ({ body: { success: true, data: requirements } }) },
    {
      method: "POST",
      path: `/api/v1/marketplace/sellers/${SELLER}/listings`,
      respond: () => {
        created++;
        return { status: 201, body: { listingId: `l-${created}`, currentDraftVersionId: `v-${created}`, versionNumber: 1, status: "DRAFT", rowVersion: "rv" } };
      },
    },
    { method: "PUT", path: /\/listings\/l-\d+\/inventory$/, respond: () => ({ body: { listingId: "l", onHandQuantity: 1, reservedQuantity: 0, sellableQuantity: 1, quantityUnitId: "u-pcs", rowVersion: "irv" } }) },
    { method: "GET", path: /\/listings$/, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) },
  ]);
  return http;
}

const CSV = [
  "title,category,description,price,currency,quantity,unit,condition,emirate,city,image_file",
  '# EXAMPLE (ignored),Switchgear,,1,AED,1,PCS,NEW,,,',
  '"Contactors, boxed",Electrical > Switchgear,"Line 1\nLine 2",1250,,200,pcs,new,Dubai,Jebel Ali,',
  "Breakers,switchgear,,0,AED,2.5,PCS,,,,",
  "Relays,Switchgear,,15.5,AED,10,,,Sharjah,,",
  "Fuses,SWITCHGEAR,,3,AED,40,,NEW,,,",
].join("\r\n");

describe("bulk upload page", () => {
  it("reviews rows against the live taxonomy, lets rows be removed, and creates the valid ones", async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/listings/bulk");

    expect(await screen.findByRole("heading", { name: "Bulk upload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download CSV template/ })).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Listings file (.csv)"), new File([CSV], "listings.csv", { type: "text/csv" }));

    const counts = await screen.findByTestId("review-counts");
    await waitFor(() => expect(counts).toHaveTextContent("4 rows · 2 valid · 2 with errors"));

    // Row numbers are spreadsheet lines (the multi-line description makes "Breakers" start on line 5).
    const breakers = screen.getByTestId("review-row-5");
    expect(within(breakers).getByText("Price must be above 0.")).toBeInTheDocument();
    expect(within(breakers).getByText("Quantity must be a whole number for Pieces (pcs).")).toBeInTheDocument();
    expect(within(screen.getByTestId("review-row-6")).getByText("Fill in both emirate and city, or leave both empty.")).toBeInTheDocument();
    expect(within(screen.getByTestId("review-row-3")).getByText("Electrical > Switchgear")).toBeInTheDocument();

    // Remove a valid row → one valid left.
    await user.click(screen.getByRole("button", { name: "Remove row 7" }));
    await waitFor(() => expect(counts).toHaveTextContent("3 rows · 1 valid · 2 with errors · 1 removed"));

    await user.click(screen.getByRole("button", { name: "Needs attention" }));
    expect(screen.queryByTestId("review-row-3")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));

    await user.click(screen.getByRole("button", { name: "Create 1 listing" }));
    await waitFor(() => expect(screen.getByTestId("run-counts")).toHaveTextContent("1 of 1 processed · 1 created · 0 failed"));
    expect(within(screen.getByTestId("progress-row-3")).getByText("Draft created")).toBeInTheDocument();
    expect(within(screen.getByTestId("progress-row-3")).getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/seller/listings/l-1");

    const create = calls.filter((c) => c.method === "POST" && c.url.pathname === `/api/v1/marketplace/sellers/${SELLER}/listings`);
    expect(create).toHaveLength(1);
    expect(create[0].headers.get("X-Idempotency-Key")).toBeTruthy();
    expect(create[0].body).toEqual({
      categoryId: "c-switch",
      title: "Contactors, boxed",
      description: "Line 1\nLine 2",
      pricingMode: "FIXED_PRICE",
      currency: "AED",
      basePrice: 1250,
      brandId: null,
      conditionId: "k-new",
      gradeId: null,
      quantityUnitId: "u-pcs",
      location: { countryCode: "AE", stateOrEmirate: "Dubai", city: "Jebel Ali" },
      expiresAtUtc: null,
    });
    expect(calls.find((c) => c.method === "PUT" && c.url.pathname.endsWith("/listings/l-1/inventory"))?.body).toMatchObject({ onHandQuantity: 200 });
  });

  it("explains that Excel files must be exported as CSV", async () => {
    setup();
    const user = userEvent.setup({ applyAccept: false });
    renderWithApp(routes, "/seller/listings/bulk");
    await user.upload(await screen.findByLabelText("Listings file (.csv)"), new File(["x"], "listings.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(await screen.findByText(/Spreadsheet files can't be read directly/)).toBeInTheDocument();
  });
});
