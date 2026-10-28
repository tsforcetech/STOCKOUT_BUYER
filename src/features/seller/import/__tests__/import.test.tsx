import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch, type MockRoute } from "@/test/http";

afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
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
    await user.upload(screen.getByLabelText(/Spreadsheet \(required\)/), new File(["a,b"], "stock.csv", { type: "text/csv" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/\.xlsx/);
    expect(screen.getByRole("button", { name: /Upload and check/ })).toBeDisabled();

    await user.upload(screen.getByLabelText(/Spreadsheet \(required\)/), new File(["xlsx"], "stock.xlsx"));
    await user.upload(screen.getByLabelText(/Product images/), new File(["zip"], "photos.zip"));
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

  it("explains a server error on the import list instead of showing an empty list", async () => {
    setup([{ method: "GET", path: BASE, respond: () => ({ status: 500, body: { error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred processing your request." } }) }]);
    renderWithApp(routes, "/seller/listings/import");
    expect(await screen.findByText(/import service hit an unexpected error/)).toBeInTheDocument();
    expect(screen.queryByText("No imports yet.")).not.toBeInTheDocument();
  });

  it("is locked for members who aren't the seller owner", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    const { calls } = mockFetch([...sessionRoutes([{ ...sellerCtx, isOwner: false }])]);
    renderWithApp(routes, "/seller/listings/import");
    expect(await screen.findByText(/You're a member, not the owner/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.startsWith(BASE))).toBe(false);
  });
});
