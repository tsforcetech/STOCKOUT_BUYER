import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import readExcelFile from "read-excel-file/universal";
import { TEMPLATE_HEADERS, readAs, writeTemplate } from "../mapping";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch, type MockRoute } from "@/test/http";

afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
  localStorage.clear();
});

const SELLER = "11111111-1111-1111-1111-111111111111";
const JOB = "22222222-2222-2222-2222-222222222222";
const BASE = `/api/v1/marketplace/sellers/${SELLER}/listings/bulk-imports`;
const sellerCtx = { sellerId: SELLER, sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "APPROVED", isOwner: true };

const jobDto = (status: string, extra: Record<string, unknown> = {}) => ({
  jobId: JOB,
  sellerId: SELLER,
  createdByUserId: "u-1",
  templateVersion: "1.0.0",
  status,
  originalFileName: "stock.xlsx",
  excelFileAssetId: null,
  zipOriginalFileName: null,
  zipFileAssetId: null,
  totalRows: 3,
  validRows: 2,
  failedRows: 1,
  warningRows: 1,
  processedRows: 0,
  createdDraftsCount: 0,
  errorSummary: null,
  createdAtUtc: "2026-10-28T08:00:00Z",
  validatedAtUtc: null,
  confirmedAtUtc: null,
  completedAtUtc: null,
  rowVersion: "rv",
  ...extra,
});
const results = (status: string, extra: Record<string, unknown> = {}) => ({
  jobId: JOB,
  sellerId: SELLER,
  status,
  totalRows: 3,
  validRows: 2,
  failedRows: 1,
  warningRows: 1,
  createdDraftsCount: 0,
  errorSummary: null,
  unmatchedZipImages: ["extra/unused.jpg"],
  createdAtUtc: "2026-10-28T08:00:00Z",
  validatedAtUtc: "2026-10-28T08:01:00Z",
  confirmedAtUtc: null,
  completedAtUtc: null,
  ...extra,
});
const row = (n: number, status: string, extra: Record<string, unknown> = {}) => ({
  rowId: `row-${n}`,
  rowNumber: n + 1,
  sellerSku: `SKU-${n}`,
  status,
  title: `Copper cable ${n}`,
  categoryId: null,
  categoryCode: "CABLES",
  brandNameOrId: null,
  conditionNameOrId: "NEW",
  gradeNameOrId: null,
  quantity: 100,
  unitNameOrId: "M",
  price: 12.5,
  currency: "AED",
  pricingMode: "FIXED",
  description: null,
  location: null,
  matchedImageCount: 1,
  coverImageRef: null,
  imageReferences: ["cable/1.jpg"],
  attributes: {},
  errors: [],
  warnings: [],
  createdListingId: null,
  createdListingVersionId: null,
  ...extra,
});
const preview = (status: string, rows: unknown[]) => ({ jobId: JOB, sellerId: SELLER, status, totalRows: 3, validRows: 2, failedRows: 1, warningRows: 1, unmatchedZipFiles: [], missingImagesCount: 0, page: 1, pageSize: 50, totalCount: rows.length, rows });

/** A filled-in StockOut template (real .xlsx), as a seller would upload it. */
async function templateFile(name = "stock.xlsx") {
  const cells = TEMPLATE_HEADERS.map((_, i) => (i === 0 ? "SKU-1" : i === 1 ? "Copper cable" : i === 6 || i === 10 ? 10 : ""));
  return new File([await writeTemplate([{ sourceRow: 2, cells, missing: [], notes: [] }])], name);
}

function setup(extra: MockRoute[]) {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  return mockFetch([...sessionRoutes([sellerCtx]), ...extra, { method: "GET", path: /\/listings$/, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) }]);
}

describe("E2 bulk import", () => {
  it("uploads the sheet and ZIP, checks them, and only imports after the seller accepts skipping error rows", async () => {
    let state = "CREATED";
    let confirmed: { body: unknown; key: string | null } | null = null;
    const { calls } = setup([
      { method: "GET", path: BASE, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) },
      { method: "POST", path: BASE, respond: () => ({ status: 201, body: jobDto("CREATED") }) },
      { method: "POST", path: `${BASE}/${JOB}/upload-excel`, respond: () => ((state = "EXCEL_UPLOADED"), { body: jobDto(state) }) },
      { method: "POST", path: `${BASE}/${JOB}/upload-images-zip`, respond: () => ({ body: jobDto(state) }) },
      { method: "POST", path: `${BASE}/${JOB}/validate`, respond: () => ((state = "VALIDATED_WITH_ERRORS"), { body: jobDto(state) }) },
      {
        method: "GET",
        path: `${BASE}/${JOB}/results`,
        respond: () => ({ body: state === "COMPLETED" ? results("PARTIALLY_COMPLETED", { createdDraftsCount: 2, completedAtUtc: "2026-10-28T08:05:00Z" }) : results(state) }),
      },
      {
        method: "GET",
        path: `${BASE}/${JOB}/preview`,
        respond: () => ({
          body: preview(state, [
            row(1, state === "COMPLETED" ? "CREATED" : "VALID", state === "COMPLETED" ? { createdListingId: "l-1" } : {}),
            row(2, "WARNING", { warnings: [{ code: "IMAGE_MISSING", field: "image_1", message: "Image not found in ZIP." }] }),
            row(3, "INVALID", { errors: [{ code: "PRICE_REQUIRED", field: "price", message: "Price is required." }] }),
          ]),
        }),
      },
      {
        method: "POST",
        path: `${BASE}/${JOB}/confirm`,
        respond: ({ init, body }) => {
          confirmed = { body, key: new Headers(init.headers).get("X-Idempotency-Key") };
          state = "COMPLETED";
          return { body: { jobId: JOB, status: "PARTIALLY_COMPLETED", totalRows: 3, createdDraftsCount: 2, failedRowsCount: 1, createdListingIds: ["l-1", "l-2"], errorSummary: null, completedAtUtc: "2026-10-28T08:05:00Z" } };
        },
      },
    ]);
    // applyAccept off: a seller can still drop or pick any file, and the page must refuse the wrong type itself.
    const user = userEvent.setup({ applyAccept: false });
    renderWithApp(routes, "/seller/listings/import");
    expect(await screen.findByRole("heading", { name: "Bulk import" })).toBeInTheDocument();
    expect(await screen.findByText("No imports yet.")).toBeInTheDocument();

    // Wrong type is refused before anything is sent.
    await user.upload(screen.getByLabelText(/Upload your product list/), new File(["x"], "stock.pdf", { type: "application/pdf" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/\.xlsx/);

    // A filled-in template is recognised and skips matching.
    await user.upload(screen.getByLabelText(/Upload your product list/), await templateFile());
    expect(await screen.findByText(/StockOut template recognised/)).toBeInTheDocument();
    expect(screen.getByText("1 products")).toBeInTheDocument();
    await user.upload(screen.getByLabelText(/Product photos/), new File(["zip"], "photos.zip"));
    await user.click(screen.getByRole("button", { name: /Upload and check/ }));

    // Job page: rows with their server messages, nothing imported yet.
    expect(await screen.findByText("Price is required.")).toBeInTheDocument();
    expect(screen.getByText("Image not found in ZIP.")).toBeInTheDocument();
    const order = calls.filter((c) => c.url.pathname.startsWith(BASE) && c.method === "POST").map((c) => c.url.pathname.replace(BASE, "") || "/");
    expect(order).toEqual(["/", `/${JOB}/upload-excel`, `/${JOB}/upload-images-zip`, `/${JOB}/validate`]);
    const excelUpload = calls.find((c) => c.url.pathname.endsWith("/upload-excel"))!;
    expect(excelUpload.body).toBeInstanceOf(FormData);
    expect(((excelUpload.body as FormData).get("file") as File).name).toBe("stock.xlsx");

    const importBtn = screen.getByRole("button", { name: /Import 2 rows/ });
    expect(importBtn).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Skip the 1 rows with errors/ }));
    await user.click(importBtn);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Create drafts" }));

    await waitFor(() => expect(confirmed).not.toBeNull());
    expect(confirmed!.body).toEqual({ allowPartialSuccess: true, expectedJobStatus: "VALIDATED_WITH_ERRORS" });
    expect(confirmed!.key).toMatch(new RegExp(`^bulk-${JOB}-`));
    expect(await screen.findByText("Import finished with some failed rows")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Copper cable 1" })).toHaveAttribute("href", "/seller/listings/l-1");
  });

  it("follows a job the server is still processing and never shows it as done early", async () => {
    let polls = 0;
    setup([
      { method: "GET", path: `${BASE}/${JOB}/results`, respond: () => ({ body: polls >= 2 ? results("COMPLETED", { createdDraftsCount: 2, failedRows: 0 }) : results("CONFIRMING", { failedRows: 0 }) }) },
      {
        method: "GET",
        path: `${BASE}/${JOB}/progress`,
        respond: () => {
          polls++;
          return { body: { jobId: JOB, status: polls >= 2 ? "COMPLETED" : "CONFIRMING", totalRows: 2, processedRows: polls >= 2 ? 2 : 1, createdDraftsCount: polls >= 2 ? 2 : 1, percentComplete: polls >= 2 ? 100 : 50, isCompleted: polls >= 2, completedAtUtc: null } };
        },
      },
      { method: "GET", path: `${BASE}/${JOB}/preview`, respond: () => ({ body: preview("COMPLETED", [row(1, "CREATED", { createdListingId: "l-1" })]) }) },
    ]);
    renderWithApp(routes, `/seller/listings/import/${JOB}`);
    expect(await screen.findByText(/Creating listing drafts/)).toBeInTheDocument();
    expect(screen.queryByText("Import finished")).not.toBeInTheDocument();
    expect(await screen.findByText("Import finished", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(polls).toBeGreaterThanOrEqual(2);
  }, 15000);

  it("treats a lost connection during confirm as unknown, not as success", async () => {
    setup([
      { method: "GET", path: `${BASE}/${JOB}/results`, respond: () => ({ body: results("VALIDATED", { failedRows: 0, warningRows: 0 }) }) },
      { method: "GET", path: `${BASE}/${JOB}/preview`, respond: () => ({ body: preview("VALIDATED", [row(1, "VALID"), row(2, "VALID")]) }) },
      { method: "POST", path: `${BASE}/${JOB}/confirm`, respond: () => ({ status: 504, body: { error: "GATEWAY_TIMEOUT", message: "timeout" } }) },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, `/seller/listings/import/${JOB}`);
    await user.click(await screen.findByRole("button", { name: /Import 2 rows/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Create drafts" }));
    expect(await screen.findByText(/lost the connection before the server answered/)).toBeInTheDocument();
    expect(screen.queryByText(/listing drafts created/)).not.toBeInTheDocument();
    expect(screen.queryByText("Import finished")).not.toBeInTheDocument();
  });

  it("shows the unit symbol and matched photo count for checked rows", async () => {
    const UNIT = "aeda56f2-0300-40db-8d3b-304d8fd87eee";
    setup([
      { method: "GET", path: `${BASE}/${JOB}/results`, respond: () => ({ body: results("VALIDATED", { failedRows: 0 }) }) },
      { method: "GET", path: `${BASE}/${JOB}/preview`, respond: () => ({ body: preview("VALIDATED", [row(1, "VALID", { categoryId: "c-1", unitNameOrId: UNIT, quantity: 3, matchedImageCount: 2, imageReferences: ["a.jpg"] })]) }) },
      { method: "GET", path: /listing-requirements$/, respond: () => ({ body: { success: true, data: { categoryId: "c-1", attributes: [], brands: [], unitRules: { categoryId: "c-1", defaultUnitId: UNIT, units: [{ unitId: UNIT, code: "PCS", name: "Pieces", symbol: "pcs" }] }, conditionRules: { categoryId: "c-1", isConditionRequired: false, conditions: [] } } } }) },
    ]);
    renderWithApp(routes, `/seller/listings/import/${JOB}`);
    expect(await screen.findByText(/^3 pcs$/)).toBeInTheDocument();
    expect(screen.queryByText(UNIT)).not.toBeInTheDocument();
    expect(screen.getByTitle(/2 photo\(s\) matched; 1 referenced/)).toHaveTextContent("2");
  });

  it("explains a server error on the import list instead of showing an empty list", async () => {
    setup([{ method: "GET", path: BASE, respond: () => ({ status: 500, body: { error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred processing your request." } }) }]);
    renderWithApp(routes, "/seller/listings/import");
    expect(await screen.findByText(/import service hit an unexpected error/)).toBeInTheDocument();
    expect(screen.queryByText("No imports yet.")).not.toBeInTheDocument();
  });

  it("explains a storage outage during upload and offers the created import", async () => {
    setup([
      { method: "GET", path: BASE, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) },
      { method: "POST", path: BASE, respond: () => ({ status: 201, body: jobDto("CREATED") }) },
      { method: "POST", path: `${BASE}/${JOB}/upload-excel`, respond: () => ({ status: 503, body: { error: "DURABLE_STORAGE_UNAVAILABLE", message: "Durable storage upload to InventoryMedia failed" } }) },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/listings/import");
    await user.upload(await screen.findByLabelText(/Upload your product list/), await templateFile());
    await user.click(await screen.findByRole("button", { name: /Upload and check/ }));
    expect(await screen.findByText(/File storage for imports is temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open this import" })).toHaveAttribute("href", `/seller/listings/import/${JOB}`);
  });

  it("converts the seller's own sheet into the template after they match the columns", async () => {
    let uploaded: File | null = null;
    setup([
      { method: "GET", path: BASE, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) },
      {
        method: "GET",
        path: "/api/v1/catalog/categories",
        respond: () => ({ body: { success: true, data: [{ categoryId: "c-pumps", slug: "pumps", parentCategoryId: null, name: "Pumps", children: [{ categoryId: "11111111-2222-3333-4444-555555555555", slug: "centrifugal", parentCategoryId: "c-pumps", name: "Centrifugal Pumps", children: [] }] }] } }),
      },
      { method: "POST", path: BASE, respond: () => ({ status: 201, body: jobDto("CREATED") }) },
      { method: "POST", path: `${BASE}/${JOB}/upload-excel`, respond: ({ body }) => ((uploaded = (body as FormData).get("file") as File), { body: jobDto("EXCEL_UPLOADED") }) },
      { method: "POST", path: `${BASE}/${JOB}/validate`, respond: () => ({ body: jobDto("VALIDATED") }) },
      { method: "GET", path: `${BASE}/${JOB}/results`, respond: () => ({ body: results("VALIDATED", { failedRows: 0 }) }) },
      { method: "GET", path: `${BASE}/${JOB}/preview`, respond: () => ({ body: preview("VALIDATED", []) }) },
    ]);
    const csv = "Stock list Oct 2026,,,,\r\nItem Code,Item Description,UOM,Qty,Rate (AED)\r\nEM-001,PPR pipe 25mm,MTR,120,\"1,250.50\"\r\nEM-002,Gate valve 2 inch,PCS,40,85\r\n";
    const user = userEvent.setup({ applyAccept: false });
    renderWithApp(routes, "/seller/listings/import");
    await user.upload(await screen.findByLabelText(/Upload your product list/), new File([csv], "ledger.csv", { type: "text/csv" }));

    // Headings found in row 2; codes, names, units, quantities and prices matched automatically.
    expect(await screen.findByTestId("mapping-counts")).toHaveTextContent("2 products · 0 ready · 2 need attention");
    expect(screen.getByText(/Still to match: Category/)).toBeInTheDocument();

    // Category: one for every row.
    await user.click(screen.getByRole("combobox", { name: "Source for Category" }));
    await user.click(await screen.findByRole("option", { name: "Same for every row…" }));
    await user.click(screen.getByRole("combobox", { name: "Category for every row" }));
    await user.click(await screen.findByRole("option", { name: "Pumps › Centrifugal Pumps" }));
    expect(screen.getByTestId("mapping-counts")).toHaveTextContent("2 products · 2 ready · 0 need attention");

    await user.click(screen.getByRole("button", { name: /Continue with 2/ }));
    expect(await screen.findByText("2 products")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Upload and check/ }));
    await waitFor(() => expect(uploaded).not.toBeNull());
    expect(uploaded!.name).toBe("stockout_import_from_your_sheet.xlsx");
    const sheets = (await readExcelFile(await readAs(uploaded!, "arrayBuffer"))) as Array<{ sheet: string; data: unknown[][] }>;
    expect(sheets[0].sheet).toBe("Products");
    expect(sheets[0].data[1].slice(0, 3)).toEqual(["EM-001", "PPR pipe 25mm", "11111111-2222-3333-4444-555555555555"]);
    expect(sheets[0].data[1][6]).toBe(1250.5);
    expect(sheets[0].data[1][10]).toBe(120);
    expect(sheets[0].data[1][11]).toBe("MTR");
    // The matching is remembered for the next file with the same headings.
    expect(localStorage.getItem("stockout.import.mappings")).toContain("item code");
  });

  it("is locked for members who aren't the seller owner", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    const { calls } = mockFetch([...sessionRoutes([{ ...sellerCtx, isOwner: false }])]);
    renderWithApp(routes, "/seller/listings/import");
    expect(await screen.findByText(/You're a member, not the owner/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.startsWith(BASE))).toBe(false);
  });
});
