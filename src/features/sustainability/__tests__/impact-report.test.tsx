import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { BuyerOrderImpact, SellerSubOrderImpact } from "../impact-report";
import BuyerImpactReportsPage from "../impact-reports-page";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const O1 = "a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d";
const SO1 = "9d1c1d2e-1111-4222-8333-444455556666";
const R1 = "d3b07384-d113-4944-9c88-e0050868f0f8";
const SELLER = "3934b874-33be-474d-9e12-247a0290c77e";
const DISCLAIMER = "Sustainability estimates are modeled cradle-to-gate approximations under EN 15804 (Stages A1-A3) and do not constitute certified carbon credits or regulatory ESG filings.";
const snap = (over: Record<string, unknown> = {}) => ({
  snapshotId: "s1", orderId: O1, subOrderId: SO1, orderLineId: "ol1", listingId: "l1", listingVersionId: "v1", acceptanceType: "ExplicitBuyerAcceptance", acceptedAtUtc: "2026-11-25T10:00:00Z",
  factorCodeApplied: "STEEL", factorVersionApplied: "1", materialCode: "STEEL", materialName: "Structural Steel Beam", materialCategory: "Metals", quantity: 100, quantityUnit: "KG", totalWeightKg: 100,
  materialImpactKgCo2e: 200, netModeledAvoidedEmissionsKgCo2e: 220, illustrativeGreenPoints: 1234, approvedEarnablePoints: null, pointsStatus: "BlockedPolicyApprovalMissing",
  passengerCarKmEquivalent: 800, verificationLevel: "UnverifiedModelEstimate", ...over,
});
const report = (over: Record<string, unknown> = {}) => ({
  reportId: R1, reportNumber: "SIR-2026-A1B2C3D4-B", orderId: O1, subOrderId: null, buyerUserId: "u1", buyerOrganizationId: null, sellerOrganizationId: SELLER, reportType: "BuyerOrderSummary",
  reportStatus: "Generated", totalPhysicalMassKg: 1500, totalEmbodiedCarbonKgCo2e: 350, totalNetAvoidedCarbonKgCo2e: 385, reportRevision: 1, supersededByReportId: null, fileAssetId: null,
  downloadUrl: `/api/v1/buyer/sustainability/reports/${R1}/download`, generatedAtUtc: "2026-11-25T14:30:00Z", createdAtUtc: "2026-11-25T14:30:00Z",
  lineSnapshots: [snap(), snap({ snapshotId: "s2", materialName: "Copper Pipe", verificationLevel: "EvidenceBackedEstimate", passengerCarKmEquivalent: 100 })],
  adjustments: [{ adjustmentId: "adj1", snapshotId: "s1", orderLineId: "ol1", adjustmentType: "Return", adjustmentReason: "2 beams returned", originalQuantity: 100, adjustedQuantity: 2, effectiveQuantity: 98, reversedMaterialImpactKgCo2e: 4, effectiveMaterialImpactKgCo2e: 196, reversedNetAvoidedEmissionsKgCo2e: 4.4, effectiveNetAvoidedEmissionsKgCo2e: 215.6, isPhysicalReturn: true, claimReference: null, createdAtUtc: "2026-11-27T10:00:00Z" }],
  environmentalDisclaimer: DISCLAIMER, ...over,
});
const at = (el: React.ReactNode, path = "/x") => renderWithApp([{ path, element: el }, { path: "/account/orders/:id", element: <div>order page</div> }], path);

describe("SUS-03 impact reports (gated)", () => {
  it("shows the backend totals, per-line basis, adjustments and the disclaimer verbatim; Green Points stay unavailable", async () => {
    mockFetch([{ method: "GET", path: `/api/v1/buyer/orders/${O1}/sustainability-report`, respond: () => ({ body: report() }) }]);
    at(<BuyerOrderImpact orderId={O1} />);
    expect(await screen.findByText("1.5 t")).toBeInTheDocument();
    expect(screen.getByText("350 kg CO₂e")).toBeInTheDocument();
    expect(screen.getByText("385 kg CO₂e")).toBeInTheDocument();
    expect(screen.getByText("900 km")).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText("Model estimate")).toBeInTheDocument();
    expect(screen.getByText("Evidence-backed")).toBeInTheDocument();
    expect(screen.getByText(/Physical return/)).toBeInTheDocument();
    expect(screen.getByText(/Green Points not yet available/)).toBeInTheDocument();
    expect(screen.queryByText(/1,234|certified carbon credit(?!s or)|StockOut Certified|audited/i)).not.toBeInTheDocument();
  });

  it("no report yet (404) is 'not available yet', never a zero", async () => {
    mockFetch([{ method: "GET", path: `/api/v1/buyer/orders/${O1}/sustainability-report`, respond: () => ({ status: 404, body: { status: 404, code: "REPORT_NOT_FOUND" } }) }]);
    at(<BuyerOrderImpact orderId={O1} />);
    expect(await screen.findByText(/Not available yet/)).toBeInTheDocument();
    expect(screen.queryByText(/0 kg/)).not.toBeInTheDocument();
  });

  it("downloads the PDF through the authenticated API and saves it under the report number", async () => {
    const created = vi.fn(() => "blob:report");
    const orig = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { calls } = mockFetch([
      { method: "GET", path: `/api/v1/buyer/orders/${O1}/sustainability-report`, respond: () => ({ body: report() }) },
      { method: "GET", path: `/api/v1/buyer/sustainability/reports/${R1}/download`, respond: () => ({ body: "%PDF-1.7", headers: { "content-type": "application/pdf" } }) },
    ]);
    at(<BuyerOrderImpact orderId={O1} />);
    await userEvent.click(await screen.findByRole("button", { name: /Download report \(PDF\)/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(created).toHaveBeenCalled();
    expect(calls.some((c) => c.url.pathname.endsWith("/download"))).toBe(true);
    click.mockRestore();
    URL.createObjectURL = orig.create;
    URL.revokeObjectURL = orig.revoke;
  });

  it("seller sub-order report sends ?sellerId=", async () => {
    const { calls } = mockFetch([{ method: "GET", path: `/api/v1/seller/suborders/${SO1}/sustainability-report`, respond: () => ({ body: report({ subOrderId: SO1, reportType: "SellerSubOrderSummary" }) }) }]);
    at(<SellerSubOrderImpact sellerId={SELLER} subOrderId={SO1} />);
    expect(await screen.findByText(DISCLAIMER)).toBeInTheDocument();
    expect(calls[0].url.searchParams.get("sellerId")).toBe(SELLER);
  });

  it("buyer list links each report to its order", async () => {
    mockFetch([{ method: "GET", path: "/api/v1/buyer/sustainability/reports", respond: () => ({ body: [report()] }) }]);
    at(<BuyerImpactReportsPage />, "/account/impact-reports");
    const link = await screen.findByRole("link", { name: /SIR-2026-A1B2C3D4-B/ });
    expect(link).toHaveAttribute("href", `/account/orders/${O1}`);
    expect(screen.getByText("1.5 t kept in use")).toBeInTheDocument();
  });
});
