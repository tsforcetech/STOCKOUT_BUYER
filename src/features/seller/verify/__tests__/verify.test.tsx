import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch, type MockRoute } from "@/test/http";
import { filesService } from "@/services/files.service";
import type { MarketplaceSellerDto, SellerDocumentResponse } from "@/api/types/user-organization";

afterEach(() => {
  vi.unstubAllGlobals();
  upload?.mockRestore();
  sessionStorage.clear();
});

// Restored per test: vi.restoreAllMocks() would also undo the global matchMedia stub.
let upload: { mockRestore: () => void } | undefined;
const mockUpload = (fileId: string) => {
  upload = vi.spyOn(filesService, "upload").mockResolvedValue({ fileId } as Awaited<ReturnType<typeof filesService.upload>>);
};

const SID = "11111111-1111-1111-1111-111111111111";
const BASE = `/api/v1/marketplace/sellers/${SID}`;
const ctx = (over: Record<string, unknown> = {}) => ({ sellerId: SID, sellerType: "BUSINESS", displayName: "TAF", status: "ACTIVE", verificationStatus: "UNVERIFIED", onboardingStatus: "DRAFT", isOwner: true, ...over });
const ALL_MISSING = ["TRADE_LICENSE", "VAT_CERTIFICATE_OR_DECLARATION", "SIGNATORY_ID_AND_AUTHORITY", "BANK_IBAN_LETTER"];

const seller = (over: Partial<MarketplaceSellerDto> = {}): MarketplaceSellerDto =>
  ({
    sellerId: SID,
    organizationType: "BUSINESS",
    email: "",
    legalName: "TAF Trading LLC",
    displayName: "TAF",
    registrationNo: null,
    countryCode: "AE",
    defaultCurrency: "AED",
    status: "ACTIVE",
    verificationStatus: "UNVERIFIED",
    onboardingStatus: "DRAFT",
    profileLogoAssetId: null,
    createdAtUtc: "2026-10-28T00:00:00",
    updatedAtUtc: "2026-10-28T00:00:00",
    rowVersion: "AAAAAAAAAAE=",
    isVatRegistered: false,
    hasVatDeclaration: false,
    mandatoryDocumentsComplete: false,
    missingDocumentCategories: ALL_MISSING,
    ...over,
  }) as MarketplaceSellerDto;

const doc = (documentType: string, over: Partial<SellerDocumentResponse> = {}): SellerDocumentResponse => ({
  sellerDocumentId: `d-${documentType}`,
  sellerId: SID,
  documentType,
  fileAssetId: `f-${documentType}`,
  documentNumber: null,
  issuedAt: null,
  expiresAt: null,
  verificationStatus: "UNVERIFIED",
  createdAtUtc: "2026-10-28T08:00:00",
  ...over,
});

const ok = (data: unknown) => ({ body: { success: true, data } });

function setup(state: { seller: MarketplaceSellerDto; docs: SellerDocumentResponse[]; context?: Record<string, unknown> }, extra: MockRoute[] = []) {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  return mockFetch([
    ...sessionRoutes([ctx(state.context)]),
    { method: "GET", path: BASE, respond: () => ok(state.seller) },
    { method: "GET", path: `${BASE}/documents`, respond: () => ok(state.docs) },
    { method: "GET", path: `${BASE}/eligibility`, respond: () => ok({ sellerId: SID, eligible: false, verificationStatus: "UNVERIFIED", canList: false, reason: null }) },
    { method: "GET", path: "/api/v1/policies/me/pending", respond: () => ok([]) },
    { method: "GET", path: "/api/v1/privacy/cookie-preferences", respond: () => ok({ cookiePreferenceId: "c", necessary: true, functional: false, analytics: false, marketing: false }) },
    ...extra,
  ]);
}

describe("seller verification steps", () => {
  it("sends an unfinished seller to the steps before the dashboard", async () => {
    setup({ seller: seller(), docs: [] });
    const { router } = renderWithApp(routes, "/seller");
    expect(await screen.findByRole("heading", { name: "Company and trade licence" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/seller/verify");
  });

  it("lets a verified seller use the dashboard", async () => {
    setup({ seller: seller({ onboardingStatus: "COMPLETED", verificationStatus: "VERIFIED" }), docs: [], context: { onboardingStatus: "COMPLETED", verificationStatus: "VERIFIED" } }, [
      { method: "GET", path: /\/listings$/, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) },
    ]);
    const { router } = renderWithApp(routes, "/seller");
    await waitFor(() => expect(router.state.location.pathname).toBe("/seller"));
    expect(screen.queryByRole("heading", { name: "Verify your business" })).not.toBeInTheDocument();
  });

  it("step 1 saves only its own fields, uploads the licence with its dates, and moves on to VAT", async () => {
    const state = { seller: seller(), docs: [] as SellerDocumentResponse[] };
    let put: Record<string, unknown> | null = null;
    let added: Record<string, unknown> | null = null;
    mockUpload("f-licence");
    setup(state, [
      {
        method: "PUT",
        path: `${BASE}/profile`,
        respond: ({ body }) => {
          put = body as Record<string, unknown>;
          state.seller = seller({ ...(put as Partial<MarketplaceSellerDto>), missingDocumentCategories: ALL_MISSING });
          return ok(state.seller);
        },
      },
      {
        method: "POST",
        path: `${BASE}/documents`,
        respond: ({ body }) => {
          added = body as Record<string, unknown>;
          state.docs = [doc("TRADE_LICENSE", { fileAssetId: "f-licence", expiresAt: "2028-11-29T00:00:00Z" })];
          state.seller = { ...state.seller, missingDocumentCategories: ALL_MISSING.slice(1) };
          return ok(state.docs[0]);
        },
      },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/verify");
    await screen.findByRole("heading", { name: "Company and trade licence" });
    await user.type(screen.getByLabelText(/Trade licence number/), "CN-1234567");
    await user.type(screen.getByLabelText(/Issued by/), "Dubai DET");
    await user.type(screen.getByLabelText(/Expiry date/), "2028-11-29");
    await user.click(screen.getByRole("combobox", { name: /Emirate/ }));
    await user.click(await screen.findByRole("option", { name: "Dubai" }));
    await user.type(screen.getByLabelText(/Business address/), "Warehouse 12, Al Quoz 3");

    await user.click(screen.getByRole("button", { name: /Save and continue/ }));
    expect(await screen.findByText("Upload your trade licence.")).toBeInTheDocument();
    expect(put).toBeNull();

    await user.upload(document.getElementById("tradeLicenceFile") as HTMLInputElement, new File(["%PDF"], "licence.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Save and continue/ }));
    expect(await screen.findByRole("heading", { name: "VAT" })).toBeInTheDocument();
    expect(put).toMatchObject({ legalName: "TAF Trading LLC", tradeLicenseNumber: "CN-1234567", issuingAuthority: "Dubai DET", stateOrEmirate: "Dubai", addressLine1: "Warehouse 12, Al Quoz 3", expectedRowVersion: "AAAAAAAAAAE=" });
    expect(put).not.toHaveProperty("bankIban");
    expect(String(put!.tradeLicenseExpiresAtUtc)).toMatch(/^2028-11-2[89]T/);
    expect(added).toMatchObject({ documentType: "TRADE_LICENSE", fileAssetId: "f-licence", documentNumber: "CN-1234567" });
  });

  it("a signatory named on the licence needs only an ID: the licence is recorded as authority proof", async () => {
    const licence = doc("TRADE_LICENSE", { fileAssetId: "f-licence", documentNumber: "CN-1", expiresAt: "2028-11-29T00:00:00Z" });
    const state = { seller: seller({ missingDocumentCategories: ["SIGNATORY_ID_AND_AUTHORITY", "BANK_IBAN_LETTER"] }), docs: [licence] };
    const added: Array<Record<string, unknown>> = [];
    mockUpload("f-eid");
    setup(state, [
      { method: "PUT", path: `${BASE}/profile`, respond: ({ body }) => ok((state.seller = { ...state.seller, ...(body as object) })) },
      { method: "POST", path: `${BASE}/documents`, respond: ({ body }) => (added.push(body as Record<string, unknown>), ok(doc(String((body as { documentType: string }).documentType)))) },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/verify?step=signatory");
    await screen.findByRole("heading", { name: "Authorised signatory" });
    await user.type(screen.getByLabelText(/Full name/), "Hakeem A");
    await user.type(screen.getByLabelText(/^Role/), "Owner");
    await user.type(screen.getByLabelText(/^Email/), "owner@taf.ae");
    await user.type(screen.getByLabelText(/^Mobile/), "+971501234567");
    expect(screen.getByRole("radio", { name: /^Yes/ })).toBeChecked();
    expect(screen.queryByText("Proof of authority (required)")).not.toBeInTheDocument();
    await user.upload(document.getElementById("idFile") as HTMLInputElement, new File(["%PDF"], "eid.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Save and continue/ }));
    await waitFor(() => expect(added).toHaveLength(2));
    expect(added[0]).toMatchObject({ documentType: "SIGNATORY_EMIRATES_ID", fileAssetId: "f-eid" });
    expect(added[1]).toMatchObject({ documentType: "TRADE_LICENSE_SIGNATORY_PROOF", fileAssetId: "f-licence", documentNumber: "CN-1" });
  });

  it("asks for a power of attorney only when the signatory isn't on the licence", async () => {
    setup({ seller: seller(), docs: [doc("TRADE_LICENSE")] });
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/verify?step=signatory");
    await screen.findByRole("heading", { name: "Authorised signatory" });
    await user.click(screen.getByRole("radio", { name: /^No/ }));
    expect(screen.getByText("Proof of authority (required)")).toBeInTheDocument();
    expect(document.querySelector('select[name="authorityType"]')).toHaveValue("SIGNATORY_POA");
  });

  it("submits from the review step once every step is done and the seller confirms", async () => {
    const complete = seller({
      tradeLicenseNumber: "CN-1",
      issuingAuthority: "Dubai DET",
      tradeLicenseExpiresAtUtc: "2028-11-29T00:00:00",
      stateOrEmirate: "Dubai",
      hasVatDeclaration: true,
      signatoryName: "Hakeem A",
      bankIban: "AE070331234567890123456",
      bankName: "Emirates NBD",
      mandatoryDocumentsComplete: true,
      missingDocumentCategories: [],
    });
    let submitted: unknown = null;
    setup({ seller: complete, docs: [doc("TRADE_LICENSE"), doc("VAT_NON_REGISTRATION_DECLARATION"), doc("SIGNATORY_EMIRATES_ID"), doc("TRADE_LICENSE_SIGNATORY_PROOF"), doc("BANK_IBAN_LETTER")] }, [
      { method: "POST", path: `${BASE}/submit`, respond: ({ body }) => ((submitted = body), ok({ ...complete, onboardingStatus: "SUBMITTED", verificationStatus: "PENDING" })) },
    ]);
    const user = userEvent.setup();
    renderWithApp(routes, "/seller/verify");
    expect(await screen.findByRole("heading", { name: "Review and submit" })).toBeInTheDocument();
    const summary = screen.getByRole("list", { name: "Summary" });
    expect(within(summary).getAllByRole("button", { name: "Edit" })).toHaveLength(4);
    const send = screen.getByRole("button", { name: /Submit for review/ });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /details are correct/ }));
    await user.click(send);
    await waitFor(() => expect(submitted).toEqual({ expectedRowVersion: "AAAAAAAAAAE=" }));
  });
});
