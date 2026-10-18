import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPage from "../search-page";
import { readSearchState, writeSearchState } from "../lib/search-params";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const card = (id: string, title: string) => ({
  listingId: id,
  publishedVersionId: `v-${id}`,
  versionNumber: 1,
  listingNumber: `LST-${id}`,
  title,
  description: null,
  categoryId: "c-1",
  categoryName: "Steel",
  categoryBreadcrumb: ["Steel"],
  brandId: null,
  brandName: null,
  conditionId: null,
  conditionName: "Unused",
  gradeId: null,
  gradeName: null,
  pricingMode: "FIXED_PRICE",
  basePrice: 949,
  currency: "AED",
  quantityUnitId: null,
  quantityUnitName: "Tonne",
  quantityUnitSymbol: "t",
  sellableQuantity: 12,
  isAvailable: true,
  expiresAtUtc: null,
  primaryImage: null,
  seller: { sellerId: "s-1", displayName: "Gulf Fabrication LLC", entityType: "BUSINESS", isVerified: true },
  location: { countryCode: "AE", stateOrEmirate: "Dubai", city: "Al Quoz" },
  attributes: [],
  publishedAtUtc: "2026-10-17T08:00:00",
});

const response = (items: unknown[], page = 1, hasNext = false) => ({
  items,
  page,
  pageSize: 24,
  totalCount: 30,
  totalPages: 2,
  sort: "relevance",
  pagination: { page, pageSize: 24, totalCount: 30, totalPages: 2, hasPreviousPage: page > 1, hasNextPage: hasNext },
  facets: {
    categories: [{ categoryId: "c-1", categoryName: "Steel", count: 30 }],
    brands: [{ id: "b-1", name: "Emirates Steel", count: 7 }],
    conditions: [],
    grades: [],
    countries: [],
    statesOrEmirates: [{ key: "Dubai", count: 20 }],
    cities: [],
    currencies: [{ key: "AED", count: 30 }],
    priceRange: { currency: "AED", minPrice: 10, maxPrice: 5000 },
    inStockCount: 25,
    attributes: [],
  },
  appliedFilters: {},
});

describe("search URL state", () => {
  it("round-trips filters through the URL", () => {
    const params = writeSearchState({ q: "steel", brandId: ["a", "b"], inStockOnly: true, sort: "price_asc", page: 2 });
    expect(params.toString()).toBe("q=steel&brandId=a&brandId=b&inStockOnly=true&sort=price_asc&page=2");
    expect(readSearchState(params)).toMatchObject({ q: "steel", brandId: ["a", "b"], inStockOnly: true, sort: "price_asc", page: 2 });
  });
  it("ignores unknown sort values", () => {
    expect(readSearchState(new URLSearchParams("sort=hack")).sort).toBe("relevance");
  });
});

describe("SearchPage", () => {
  it("renders results and facet filters from the API, and filters by brand", async () => {
    const { calls } = mockFetch([{ method: "GET", path: "/api/v1/search/listings", respond: () => ({ body: response([card("1", "Structural Steel Channels — S355")], 1, true) }) }]);
    const { router } = renderWithApp([{ path: "/search", element: <SearchPage /> }, { path: "/login", element: <div /> }], "/search?q=steel");
    expect(await screen.findByText("Structural Steel Channels — S355")).toBeInTheDocument();
    expect(screen.getByText("30 listings")).toBeInTheDocument();
    expect(calls[0].url.searchParams.get("q")).toBe("steel");

    const aside = screen.getByRole("complementary", { name: "Filters" });
    await userEvent.click(within(aside).getByLabelText(/Emirates Steel/));
    expect(router.state.location.search).toContain("brandId=b-1");
  });

  it("sends a currency whenever price sorting is used", async () => {
    const { calls } = mockFetch([{ method: "GET", path: "/api/v1/search/listings", respond: () => ({ body: response([]) }) }]);
    renderWithApp([{ path: "/search", element: <SearchPage /> }], "/search?sort=price_asc");
    expect(await screen.findByText("No listings match your search")).toBeInTheDocument();
    expect(calls[0].url.searchParams.get("currency")).toBe("AED");
  });

  it("asks anonymous users to log in before saving a search", async () => {
    mockFetch([{ method: "GET", path: "/api/v1/search/listings", respond: () => ({ body: response([card("1", "Copper cable")]) }) }]);
    const { router } = renderWithApp([{ path: "/search", element: <SearchPage /> }, { path: "/login", element: <div>Login</div> }], "/search?q=copper");
    await screen.findByText("Copper cable");
    await userEvent.click(screen.getByRole("button", { name: /Save search/ }));
    expect(await screen.findByText("Login")).toBeInTheDocument();
    expect(router.state.location.search).toContain("next=");
  });

  it("shows a removable chip per applied filter, resolving names from facets", async () => {
    mockFetch([{ method: "GET", path: "/api/v1/search/listings", respond: () => ({ body: response([card("1", "Copper cable")]) }) }]);
    const { router } = renderWithApp([{ path: "/search", element: <SearchPage /> }], "/search?q=copper&categoryId=c-1&brandId=b-1&stateOrEmirate=Dubai&inStockOnly=true&sort=date_desc");
    await screen.findByText("Copper cable");
    const chips = screen.getByRole("group", { name: "Applied filters" });
    expect(within(chips).getByText("Emirates Steel")).toBeInTheDocument();
    expect(within(chips).getByText("Steel")).toBeInTheDocument();

    await userEvent.click(within(chips).getByRole("button", { name: "Remove filter: Emirates Steel" }));
    expect(router.state.location.search).not.toContain("brandId");
    expect(router.state.location.search).toContain("categoryId=c-1");

    await userEvent.click(within(screen.getByRole("group", { name: "Applied filters" })).getByRole("button", { name: "Clear all" }));
    expect(router.state.location.search).toBe("?sort=date_desc");
  });

  it("switches to list view and remembers the choice", async () => {
    localStorage.removeItem("stockout.market.searchView");
    mockFetch([{ method: "GET", path: "/api/v1/search/listings", respond: () => ({ body: response([card("1", "Copper cable")]) }) }]);
    renderWithApp([{ path: "/search", element: <SearchPage /> }], "/search");
    await screen.findByText("Copper cable");
    const listBtn = screen.getByRole("button", { name: "List view" });
    expect(listBtn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(listBtn);
    expect(listBtn).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("stockout.market.searchView")).toBe("list");
    expect(screen.getByRole("button", { name: "Save Copper cable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Copper cable" })).toHaveAttribute("href", "/listings/1");
    localStorage.removeItem("stockout.market.searchView");
  });

  it("opens the mobile filters sheet with a live result count", async () => {
    mockFetch([{ method: "GET", path: "/api/v1/search/listings", respond: () => ({ body: response([card("1", "Copper cable")]) }) }]);
    renderWithApp([{ path: "/search", element: <SearchPage /> }], "/search");
    await screen.findByText("Copper cable");
    await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = await screen.findByRole("dialog", { name: /Filters/ });
    expect(within(sheet).getByLabelText(/Emirates Steel/)).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Show 30 results" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
