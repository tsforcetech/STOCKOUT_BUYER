import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Browser smoke tests against the production build. API calls are intercepted with page.route():
 * these verify routing, rendering, auth wiring and responsive layout — NOT live backend behaviour.
 */
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const card = {
  listingId: "aaaaaaaa-0000-0000-0000-000000000001",
  publishedVersionId: "v1",
  versionNumber: 1,
  listingNumber: "LST-0001",
  title: "Structural Steel Channels — S355",
  description: null,
  categoryId: "c1",
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
  primaryImage: { fileAssetId: "f1", cdnUrl: "/api/v1/files/f1/download" },
  seller: { sellerId: "s1", displayName: "Gulf Fabrication LLC", entityType: "BUSINESS", isVerified: true },
  location: { countryCode: "AE", stateOrEmirate: "Dubai", city: "Al Quoz" },
  attributes: [],
  publishedAtUtc: "2026-10-17T08:00:00",
};

const searchResponse = {
  items: [card],
  page: 1,
  pageSize: 24,
  totalCount: 1,
  totalPages: 1,
  sort: "relevance",
  pagination: { page: 1, pageSize: 24, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
  facets: {
    categories: [{ categoryId: "c1", categoryName: "Steel", count: 1 }],
    brands: [],
    conditions: [],
    grades: [],
    countries: [],
    statesOrEmirates: [{ key: "Dubai", count: 1 }],
    cities: [],
    currencies: [{ key: "AED", count: 1 }],
    priceRange: { currency: "AED", minPrice: 949, maxPrice: 949 },
    inStockCount: 1,
    attributes: [],
  },
  appliedFilters: {},
};

async function mockApi(page: Page, opts: { sellerContexts?: unknown[] } = {}) {
  // Registered first: later routes take priority in Playwright.
  await page.route("**/api/v1/**", (r) => json(r, { error: "NOT_MOCKED" }, 404));
  await page.route("**/api/v1/catalog/categories", (r) => json(r, { success: true, data: [{ categoryId: "c1", slug: "steel", parentCategoryId: null, name: "Steel", children: [] }] }));
  await page.route("**/api/v1/search/listings**", (r) => json(r, searchResponse));
  await page.route("**/api/v1/search/suggest**", (r) => json(r, { prefix: "st", limit: 8, totalCount: 0, suggestions: [] }));
  await page.route(`**/api/v1/catalog/listings/${card.listingId}`, (r) =>
    json(r, {
      ...card,
      listingVersionId: "v1",
      unitOfMeasure: "t",
      categoryPathIds: ["c1"],
      sellableOnHandQuantity: 12,
      primaryMediaUrl: null,
      galleryImages: [],
      galleryMediaUrls: [],
      attributes: [{ code: "THICKNESS", name: "Thickness", textValue: "8 mm", numValue: null, numericValue: null }],
    }),
  );
  await page.route("**/api/v1/auth/login", (r) => json(r, { accessToken: "a.eyJzaWQiOiJzMSJ9.c", refreshToken: "rt", expiresIn: 900, tokenType: "Bearer", mfaRequired: false, mfaChallengeToken: null }));
  await page.route("**/api/v1/auth/token/refresh", (r) => json(r, { accessToken: "a.eyJzaWQiOiJzMSJ9.c", refreshToken: "rt2", expiresIn: 900, tokenType: "Bearer" }));
  await page.route("**/api/v1/identity/me", (r) =>
    json(r, { userId: "u1", email: "bea@stockout.test", emailVerified: true, mobile: "", mobileVerified: false, status: "Active", authTime: "", amr: "pwd", firstName: "Bea", lastName: "Buyer", displayName: "Bea Buyer" }),
  );
  await page.route("**/api/v1/marketplace/actors/me", (r) => json(r, { success: true, data: { userId: "u1", buyer: { enabled: true }, sellerContexts: opts.sellerContexts ?? [] } }));
}

test("anonymous visitor browses home → search → listing detail", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find surplus stock/i })).toBeVisible();
  await expect(page.getByText(card.title).first()).toBeVisible();
  await page.goto("/search?q=steel");
  await expect(page.getByText("1 listings")).toBeVisible();
  await page.getByRole("link", { name: new RegExp(card.title) }).first().click();
  await expect(page.getByRole("heading", { name: card.title, level: 1 })).toBeVisible();
  await expect(page.getByText("8 mm")).toBeVisible();
});

test("seller portal requires login and sends new sellers to onboarding", async ({ page }) => {
  await mockApi(page, { sellerContexts: [] });
  await page.goto("/seller");
  await expect(page).toHaveURL(/\/login\?next=%2Fseller/);
  await page.getByLabel("Email", { exact: true }).fill("bea@stockout.test");
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/seller\/onboarding/);
  await expect(page.getByRole("button", { name: "Create seller account" })).toBeVisible();
});

test("registration page is reachable from login", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("unknown routes render the 404 page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("no horizontal overflow on home and search", async ({ page }) => {
  await mockApi(page);
  for (const path of ["/", "/search?q=steel"]) {
    await page.goto(path);
    await expect(page.getByText(card.title).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("visitors can switch between light and dark theme", async ({ page }) => {
  await mockApi(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("shell and pages survive edge-case API data (wrapped envelopes, null lists, HTML bodies)", async ({ page }) => {
  await mockApi(page);
  // Signed-in visitor restoring a session from a previous page load.
  await page.addInitScript(() => sessionStorage.setItem("stockout.market.rt", "rt-old"));
  // Envelope with extra keys must still be unwrapped (otherwise an object reaches `.map`/`.find`).
  await page.route("**/api/v1/catalog/categories", (r) =>
    json(r, { success: true, data: [{ categoryId: "c1", slug: "steel", parentCategoryId: null, name: "Steel", children: null }], message: null, errors: null }),
  );
  // C# `#nullable disable` collection left unset.
  await page.route("**/api/v1/marketplace/actors/me", (r) => json(r, { success: true, data: { userId: "u1", buyer: { enabled: true }, sellerContexts: null } }));
  // A proxy/CDN answering 200 with an HTML page instead of JSON.
  await page.route("**/api/v1/search/listings**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body>Please wait…</body></html>" }));

  const crashed = page.getByText(/This page couldn't be displayed|Something went wrong on this page/);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
  await expect(page.getByText(/Listings couldn't be loaded/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Steel" }).first()).toBeVisible();
  await expect(crashed).toHaveCount(0);

  await page.goto("/search?q=steel");
  await expect(page.getByText("Couldn't load this data")).toBeVisible();
  await expect(crashed).toHaveCount(0);

  await page.goto("/categories");
  await expect(page.getByRole("heading", { name: "Browse all categories" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Steel" }).first()).toBeVisible();
  await expect(crashed).toHaveCount(0);
});

test("leaving the site layout works when scrollTo returns a Promise (newer Chrome)", async ({ page }) => {
  await page.addInitScript(() => {
    window.scrollTo = (() => Promise.resolve()) as unknown as typeof window.scrollTo;
  });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find surplus stock/i })).toBeVisible();
  await page.getByRole("link", { name: "Login", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to StockOut" })).toBeVisible();
  await expect(page.getByText("couldn't be displayed")).toHaveCount(0);
});
