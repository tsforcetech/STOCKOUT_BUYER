import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

const SELLER = "11111111-1111-1111-1111-111111111111";
const LISTING = "22222222-2222-2222-2222-222222222222";
const COR = "33333333-3333-3333-3333-333333333333";
const ctx = { sellerId: SELLER, sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true };
const base = `/api/v1/marketplace/sellers/${SELLER}/listings`;
const correction = {
  correctionId: COR,
  correctionNo: "COR-2026-000001",
  listingId: LISTING,
  baseListingVersionId: "v-1",
  inspectionId: "i-1",
  status: "AWAITING_SELLER_DECISION",
  requiresSellerAcceptance: true,
  sellerVisibleSummary: "Valve is DN100, not DN80; price adjusted.",
  changes: [
    { field: "title", before: "Gate valve DN80", after: "Gate valve DN100", requiresSellerAcceptance: false },
    { field: "price", before: "10", after: "12.5", requiresSellerAcceptance: true },
  ],
  quantityApplicationStatus: "NOT_APPLICABLE",
  sellerDecision: null,
  sellerDecisionAtUtc: null,
  sellerDecisionReason: null,
  disputeRequestedAtUtc: null,
  correctedListingVersionId: null,
  createdAtUtc: "2026-10-29T10:00:00",
  updatedAtUtc: null,
  rowVersion: "rv-1",
};
const common = [
  ...sessionRoutes([ctx]),
  { method: "GET", path: `${base}/${LISTING}`, respond: () => ({ body: { listingId: LISTING, sellerId: SELLER, status: "PUBLISHED", currentDraftVersionId: null, currentDraftVersion: null, publishedVersionId: "v-1", publishedVersion: { versionNumber: 1, title: "Gate valve DN80", categoryId: "c-1" }, rowVersion: "rv", expiresAtUtc: null } }) },
  { method: "GET", path: /\/listing-requirements$/, respond: () => ({ body: { success: true, data: { categoryId: "c-1", attributes: [], brands: [], unitRules: { units: [] }, conditionRules: { categoryId: "c-1", isConditionRequired: false, conditions: [] } } } }) },
  { method: "GET", path: `${base}/${LISTING}/corrections/${COR}`, respond: () => ({ body: correction }) },
];

beforeEach(() => localStorage.setItem("stockout.market.rt", "rt-1"));
afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("E5 seller correction decision", () => {
  it("shows original vs proposed and accepts with the row version", async () => {
    const { calls } = mockFetch([
      ...common,
      {
        method: "POST",
        path: `${base}/${LISTING}/corrections/${COR}/decision`,
        respond: () => ({ body: { correction: { ...correction, status: "SUBMITTED_TO_MODERATION", sellerDecision: "ACCEPT" }, isIdempotentReplay: false, moderationEntryStatus: "SUBMITTED_TO_MODERATION", moderationEntryBlockedCode: null, reinspectionRequestEligible: null } }),
      },
    ]);
    renderWithApp(routes, `/seller/listings/${LISTING}/corrections/${COR}`);
    expect(await screen.findByText("Valve is DN100, not DN80; price adjusted.")).toBeInTheDocument();
    const priceRow = screen.getAllByRole("rowheader", { name: "Price" })[0]!.closest("tr")!;
    expect(within(priceRow).getByText("10")).toBeInTheDocument();
    expect(within(priceRow).getByText("12.5")).toBeInTheDocument();
    expect(within(priceRow).getByText("Needs your OK")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Accept changes/ }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.pathname.endsWith("/decision"))?.body).toEqual({ decision: "ACCEPT", reason: null, expectedRowVersion: "rv-1" }));
    expect(await screen.findByText("Accepted — sent for review")).toBeInTheDocument();
  });

  it("needs a reason to decline and offers re-inspection only when eligible", async () => {
    const { calls } = mockFetch([
      ...common,
      {
        method: "POST",
        path: `${base}/${LISTING}/corrections/${COR}/decision`,
        respond: () => ({ body: { correction: { ...correction, status: "SELLER_DECLINED", sellerDecision: "DECLINE", sellerDecisionReason: "Price is right" }, isIdempotentReplay: false, moderationEntryStatus: null, moderationEntryBlockedCode: null, reinspectionRequestEligible: false } }),
      },
    ]);
    renderWithApp(routes, `/seller/listings/${LISTING}/corrections/${COR}`);
    await userEvent.click(await screen.findByRole("button", { name: /Decline/ }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Decline" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), "Price is right");
    await userEvent.click(confirm);
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith("/decision"))?.body).toMatchObject({ decision: "DECLINE", reason: "Price is right" }));
    expect(await screen.findByText(/contact StockOut support/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Request re-inspection/ })).not.toBeInTheDocument();
  });

  it("explains an accepted correction that couldn't enter review because of an open draft", async () => {
    mockFetch([
      ...common,
      {
        method: "POST",
        path: `${base}/${LISTING}/corrections/${COR}/decision`,
        respond: () => ({ body: { correction: { ...correction, status: "SELLER_ACCEPTED", sellerDecision: "ACCEPT" }, isIdempotentReplay: false, moderationEntryStatus: "PENDING_MODERATION_ENTRY", moderationEntryBlockedCode: "MARKETPLACE_CORRECTION_LISTING_DRAFT_CONFLICT", reinspectionRequestEligible: null } }),
      },
    ]);
    renderWithApp(routes, `/seller/listings/${LISTING}/corrections/${COR}`);
    await userEvent.click(await screen.findByRole("button", { name: /Accept changes/ }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Accept" }));
    expect(await screen.findByText(/unfinished update on this listing/)).toBeInTheDocument();
  });

  it("lists proposals that need a decision", async () => {
    mockFetch([
      ...sessionRoutes([ctx]),
      { method: "GET", path: `${base}/corrections`, respond: () => ({ body: { items: [correction], totalCount: 1, page: 1, pageSize: 100 } }) },
      { method: "GET", path: base, respond: () => ({ body: { items: [{ listingId: LISTING, title: "Gate valve DN80", status: "PUBLISHED" }], totalCount: 1 } }) },
    ]);
    renderWithApp(routes, "/seller/corrections");
    const link = await screen.findByRole("link", { name: /Gate valve DN80/ });
    expect(link).toHaveAttribute("href", `/seller/listings/${LISTING}/corrections/${COR}`);
    expect(screen.getByText("Needs your decision", { selector: "span" })).toBeInTheDocument();
  });
});
