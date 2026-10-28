import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { filesService } from "@/services/files.service";
import { suggestCategories } from "../lib/quick-listing";
import type { CategoryEntry } from "../lib/queries";

const SELLER = "11111111-1111-1111-1111-111111111111";
const CAT_GATE = "c0000000-0000-0000-0000-000000000002";
const CAT_PUMP = "c0000000-0000-0000-0000-000000000004";
const UNIT = "u0000000-0000-0000-0000-000000000001";

const tree = [
  { categoryId: "c0000000-0000-0000-0000-000000000001", slug: "valves", parentCategoryId: null, name: "Valves", children: [{ categoryId: CAT_GATE, slug: "gate", parentCategoryId: "c1", name: "Gate Valves", children: [] }] },
  { categoryId: "c0000000-0000-0000-0000-000000000003", slug: "pumps", parentCategoryId: null, name: "Pumps", children: [{ categoryId: CAT_PUMP, slug: "centrifugal", parentCategoryId: "c3", name: "Centrifugal Pumps", children: [] }] },
];
const requirements = {
  categoryId: CAT_GATE,
  attributes: [],
  brands: [],
  unitRules: { categoryId: CAT_GATE, defaultUnitId: UNIT, units: [{ unitId: UNIT, code: "PCS", name: "Pieces", symbol: "pcs", unitType: "COUNT", minQuantity: null, maxQuantity: null, quantityDecimalPrecision: 0, isInherited: false, sourceCategoryId: CAT_GATE }] },
  conditionRules: { categoryId: CAT_GATE, isConditionRequired: false, conditions: [] },
};
const ctx = { sellerId: SELLER, sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true };
const base = `/api/v1/marketplace/sellers/${SELLER}/listings`;
const common = [
  ...sessionRoutes([ctx]),
  { method: "GET", path: /\/api\/v1\/catalog\/categories$/, respond: () => ({ body: { success: true, data: tree } }) },
  { method: "GET", path: /\/listing-requirements$/, respond: () => ({ body: { success: true, data: requirements } }) },
  { method: "GET", path: `/api/v1/marketplace/sellers/${SELLER}`, respond: () => ({ body: { sellerId: SELLER, defaultCurrency: "AED" } }) },
];

let upload: { mockRestore: () => void } | null = null;
beforeEach(() => {
  localStorage.setItem("stockout.market.rt", "rt-1");
});
afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
  upload?.mockRestore();
  upload = null;
  localStorage.clear();
});

describe("category suggestion", () => {
  it("suggests leaf categories that share words with the title", () => {
    const entries: CategoryEntry[] = [
      { categoryId: "v", name: "Valves", path: ["Valves"], depth: 0, isLeaf: false },
      { categoryId: "g", name: "Gate Valves", path: ["Valves", "Gate Valves"], depth: 1, isLeaf: true },
      { categoryId: "b", name: "Ball Valves", path: ["Valves", "Ball Valves"], depth: 1, isLeaf: true },
      { categoryId: "p", name: "Centrifugal Pumps", path: ["Pumps", "Centrifugal Pumps"], depth: 1, isLeaf: true },
    ];
    expect(suggestCategories("Brass gate valve 2 inch, unused", entries).map((c) => c.categoryId)).toEqual(["g", "b"]);
    expect(suggestCategories("Pump 5HP", entries)[0]?.categoryId).toBe("p");
    expect(suggestCategories("", entries)).toEqual([]);
  });
});

describe("quick add", () => {
  it("creates the draft, attaches the photo as cover, sets stock and sends it for review in one go", async () => {
    upload = vi.spyOn(filesService, "upload").mockResolvedValue({ fileId: "f-1" } as Awaited<ReturnType<typeof filesService.upload>>);
    const { calls } = mockFetch([
      ...common,
      { method: "POST", path: base, respond: () => ({ body: { listingId: "L-1", currentDraftVersionId: "V-1", versionNumber: 1, status: "DRAFT", rowVersion: "rv-1" } }) },
      { method: "POST", path: `${base}/L-1/media`, respond: () => ({ body: { listingId: "L-1", listingVersionId: "V-1", fileAssetId: "f-1", rowVersion: "rv-2", association: {} } }) },
      { method: "PUT", path: `${base}/L-1/inventory`, respond: () => ({ body: { listingId: "L-1", onHandQuantity: 40, reservedQuantity: 0, sellableQuantity: 40, quantityUnitId: UNIT, rowVersion: "inv-1" } }) },
      { method: "POST", path: `${base}/L-1/submit`, respond: () => ({ body: { listingId: "L-1", listingVersionId: "V-1", status: "UNDER_REVIEW", submittedAtUtc: "2026-10-28T10:00:00Z", rowVersion: "rv-3" } }) },
      { method: "GET", path: base, respond: () => ({ body: { items: [], totalCount: 0 } }) },
    ]);
    const user = userEvent.setup();
    const { container } = renderWithApp(routes, "/seller/listings/quick");

    await user.type(await screen.findByLabelText(/What are you selling/), "Brass gate valve 2 inch");
    const suggestion = await screen.findByRole("radio", { name: /Gate Valves/ });
    await waitFor(() => expect(suggestion).toHaveAttribute("aria-checked", "true"));
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "valve.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Cover")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Price per unit/), "250");
    await user.type(screen.getByLabelText(/Quantity in stock/), "40");
    await waitFor(() => expect(container.querySelector<HTMLSelectElement>("select")?.value ?? UNIT).toBe(UNIT));
    await user.click(screen.getByRole("button", { name: /Save and send for review/ }));

    expect(await screen.findByText("Listed and sent for review")).toBeInTheDocument();
    const created = calls.find((c) => c.method === "POST" && c.url.pathname === base)!;
    expect(created.body).toMatchObject({ categoryId: CAT_GATE, title: "Brass gate valve 2 inch", basePrice: 250, currency: "AED", pricingMode: "FIXED_PRICE", quantityUnitId: UNIT });
    expect(calls.find((c) => c.url.pathname.endsWith("/media"))!.body).toEqual({ expectedRowVersion: "rv-1", fileAssetId: "f-1", mediaType: "IMAGE", isPrimary: true });
    expect(calls.find((c) => c.url.pathname.endsWith("/inventory"))!.body).toEqual({ expectedRowVersion: null, onHandQuantity: 40 });
    expect(calls.find((c) => c.url.pathname.endsWith("/submit"))!.body).toEqual({ listingVersionId: "V-1", expectedRowVersion: "rv-2" });
    // Ready for the next one, with the category remembered.
    expect(screen.getByLabelText(/What are you selling/)).toHaveValue("");
    expect(JSON.parse(localStorage.getItem("stockout.seller.quick-add")!)[SELLER]).toMatchObject({ categoryId: CAT_GATE, currency: "AED" });
  });
});

const row = (n: number, status: string, v: string | null) => ({
  listingId: `L-${n}`,
  sellerId: SELLER,
  status,
  currentDraftVersionId: v ? `V-${n}` : null,
  currentDraftVersionStatus: v,
  publishedVersionId: status === "PUBLISHED" ? `P-${n}` : null,
  createdAtUtc: "2026-10-20T08:00:00",
  updatedAtUtc: null,
  title: `Listing ${n}`,
  categoryId: CAT_GATE,
  requiresPhysicalInspection: false,
});
const version = (n: number, price: number) => ({
  listingVersionId: `V-${n}`,
  versionNumber: 1,
  categoryId: CAT_GATE,
  title: `Listing ${n}`,
  description: null,
  pricingMode: "FIXED_PRICE",
  currency: "AED",
  basePrice: price,
  brandId: null,
  conditionId: null,
  gradeId: null,
  quantityUnitId: UNIT,
  location: null,
});

function listingsRoutes(items: ReturnType<typeof row>[], prices: Record<string, number> = {}) {
  return [
    ...common,
    { method: "GET", path: base, respond: () => ({ body: { items, totalCount: items.length } }) },
    {
      method: "GET",
      path: /\/listings\/L-\d$/,
      respond: ({ url }: { url: URL }) => {
        const id = url.pathname.split("/").pop()!;
        const l = items.find((i) => i.listingId === id)!;
        const n = Number(id.slice(2));
        const v = version(n, prices[id] ?? 100);
        return { body: { listingId: id, sellerId: SELLER, status: l.status, currentDraftVersionId: l.currentDraftVersionId, publishedVersionId: l.publishedVersionId, expiresAtUtc: null, rowVersion: `rv-${id}`, currentDraftVersion: l.currentDraftVersionId ? v : null, publishedVersion: l.publishedVersionId ? v : null } };
      },
    },
    { method: "GET", path: /\/inventory$/, respond: ({ url }: { url: URL }) => ({ body: { listingId: url.pathname.split("/")[6], onHandQuantity: 10, reservedQuantity: 2, sellableQuantity: 8, quantityUnitId: UNIT, rowVersion: "inv-rv" } }) },
    { method: "GET", path: /\/media$/, respond: () => ({ body: { listingId: "x", listingVersionId: "x", rowVersion: "x", media: [] } }) },
  ];
}

describe("managing listings without pop-ups", () => {
  it("pauses straight away and offers Undo", async () => {
    const { calls } = mockFetch([
      ...listingsRoutes([row(1, "PUBLISHED", null)]),
      { method: "POST", path: `${base}/L-1/pause`, respond: () => ({ body: { rowVersion: "rv-p" } }) },
      { method: "POST", path: `${base}/L-1/resume`, respond: () => ({ body: { rowVersion: "rv-r" } }) },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/listings");
    await user.click(await screen.findByRole("button", { name: "Pause" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText(/Listing paused/)).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith("/pause"))!.body).toEqual({ remarks: null, expectedRowVersion: "rv-L-1" });
    // sonner captures the pointer on press, which jsdom lacks; a plain click runs the same action.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith("/resume"))).toBe(true));
  });

  it("changes stock from the card", async () => {
    const { calls } = mockFetch([
      ...listingsRoutes([row(1, "PUBLISHED", null)]),
      { method: "PUT", path: `${base}/L-1/inventory`, respond: () => ({ body: { listingId: "L-1", onHandQuantity: 75, reservedQuantity: 2, sellableQuantity: 73, quantityUnitId: UNIT, rowVersion: "inv-2" } }) },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/listings");
    await user.click(await screen.findByRole("button", { name: "Edit stock of listing 1" }));
    const box = screen.getByLabelText("Stock of Listing 1");
    await user.clear(box);
    await user.type(box, "75{Enter}");
    expect(await screen.findByText("73 in stock")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ expectedRowVersion: "inv-rv", onHandQuantity: 75, reasonCode: "STOCK_COUNT" });
  });

  it("reprices selected drafts by a percentage and skips listings that can't be repriced", async () => {
    const { calls } = mockFetch([
      ...listingsRoutes([row(1, "DRAFT", "DRAFT"), row(2, "DRAFT", "DRAFT"), row(3, "PUBLISHED", null)], { "L-1": 100, "L-2": 49.99 }),
      { method: "PUT", path: /\/listings\/L-\d$/, respond: () => ({ body: { rowVersion: "rv-new" } }) },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/listings");
    await user.click(await screen.findByRole("checkbox", { name: "Select Listing 1" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Listing 2" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Listing 3" }));
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    expect(within(bar).getByText("3 selected")).toBeInTheDocument();
    await user.click(within(bar).getByRole("button", { name: /Change price \(2\)/ }));
    await user.type(within(bar).getByLabelText("Price change in percent"), "-10");
    await user.click(within(bar).getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(/Repriced: 2 · skipped \(not possible for their status\): 1/)).toBeInTheDocument();
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.map((c) => (c.body as { basePrice: number }).basePrice)).toEqual([90, 44.99]);
    expect(puts[0]!.body).toMatchObject({ title: "Listing 1", categoryId: CAT_GATE, quantityUnitId: UNIT, expectedRowVersion: "rv-L-1" });
  });
});
