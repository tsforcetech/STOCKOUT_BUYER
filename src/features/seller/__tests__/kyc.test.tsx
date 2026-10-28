import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { filesService } from "@/services/files.service";
import type { MarketplaceSellerDto, SellerDocumentResponse } from "@/api/types/user-organization";
import { AddDocumentDialog } from "../components/add-document-dialog";
import { BusinessProfileDialog } from "../components/business-profile-dialog";
import { kycBlockerHints, kycChecklist, licenceFromDocuments, licenceProblem } from "../lib/kyc";
import { KycChecklist } from "../components/kyc-checklist";
import { QueryClient } from "@tanstack/react-query";
import { sellerKeys } from "../lib/queries";

afterEach(() => vi.unstubAllGlobals());

const seller = (over: Partial<MarketplaceSellerDto> = {}): MarketplaceSellerDto =>
  ({
    sellerId: "s-1",
    organizationType: "BUSINESS",
    email: "",
    legalName: "Gulf Surplus FZE",
    displayName: "Gulf Surplus",
    registrationNo: null,
    countryCode: "AE",
    defaultCurrency: "AED",
    status: "ACTIVE",
    verificationStatus: "UNVERIFIED",
    onboardingStatus: "DRAFT",
    profileLogoAssetId: null,
    submittedAtUtc: null,
    verifiedAtUtc: null,
    rejectedAtUtc: null,
    suspendedAtUtc: null,
    createdAtUtc: "2026-10-01T00:00:00",
    updatedAtUtc: "2026-10-01T00:00:00",
    rowVersion: "AAAAAAAAAAE=",
    isVatRegistered: false,
    hasVatDeclaration: false,
    missingDocumentCategories: ["TRADE_LICENSE", "VAT_CERTIFICATE_OR_DECLARATION", "SIGNATORY_ID_AND_AUTHORITY", "BANK_IBAN_LETTER"],
    ...over,
  }) as MarketplaceSellerDto;

const doc = (documentType: string, over: Partial<SellerDocumentResponse> = {}): SellerDocumentResponse => ({
  sellerDocumentId: `d-${documentType}`,
  sellerId: "s-1",
  documentType,
  fileAssetId: "f-1",
  documentNumber: null,
  issuedAt: null,
  expiresAt: null,
  verificationStatus: "UNVERIFIED",
  createdAtUtc: "2026-10-01T00:00:00",
  ...over,
});

describe("KYC checklist", () => {
  it("splits the signatory requirement into identity and authority, honouring declared combined files", () => {
    const s = seller({ missingDocumentCategories: ["TRADE_LICENSE", "VAT_CERTIFICATE_OR_DECLARATION", "SIGNATORY_ID_AND_AUTHORITY", "BANK_IBAN_LETTER"] });
    const rows = kycChecklist(s, [doc("SIGNATORY_PASSPORT")]);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.SIGNATORY_ID.missing).toBe(false);
    expect(by.SIGNATORY_AUTHORITY.missing).toBe(true);
    const combined = kycChecklist(s, [doc("SIGNATORY_POA_OR_PASSPORT", { containsSignatoryId: true, containsSignatoryAuthorityProof: true })]);
    expect(combined.find((r) => r.key === "SIGNATORY_AUTHORITY")!.missing).toBe(false);
  });

  it("flags generic VAT documents and requires a future licence expiry", () => {
    const rows = kycChecklist(seller(), [doc("VAT_CERTIFICATE_OR_DECLARATION")]);
    expect(rows.find((r) => r.key === "VAT")!.needsClassification).toBe(true);
    expect(licenceProblem(seller())).toMatch(/expiry date/);
    expect(licenceProblem(seller({ tradeLicenseExpiresAtUtc: "2020-01-01T00:00:00" }))).toMatch(/expired/);
    expect(licenceProblem(seller({ tradeLicenseExpiresAtUtc: "2099-01-01T00:00:00" }))).toBeNull();
  });
});

describe("KYC blocker hints", () => {
  it("explains uploaded files the server doesn't count, instead of asking to upload again", () => {
    const vatOnly = seller({ missingDocumentCategories: ["VAT_CERTIFICATE_OR_DECLARATION"] });
    expect(kycBlockerHints(vatOnly, [doc("VAT_NON_REGISTRATION_DECLARATION")]).join(" ")).toMatch(/doesn't yet confirm the business isn't VAT registered/);
    expect(kycBlockerHints({ ...vatOnly, isVatRegistered: true }, [doc("VAT_DECLARATION")]).join(" ")).toMatch(/VAT\/TRN certificate is needed/);
    expect(kycBlockerHints(vatOnly, [doc("TRN_CERTIFICATE")]).join(" ")).toMatch(/certificate you uploaded doesn't count/);
    expect(kycBlockerHints(seller(), [doc("BANK_IBAN_LETTER", { expiresAt: "2020-01-01T00:00:00Z" })]).join(" ")).toMatch(/expired on 01\/01\/2020/);
    expect(kycBlockerHints(seller(), [doc("Trade licence")]).join(" ")).toMatch(/without a recognised document type/);
    expect(kycBlockerHints(seller({ missingDocumentCategories: [] }), [doc("TRADE_LICENSE")])).toEqual([]);
  });
});

describe("Checklist profile fixes", () => {
  it("sends a declared-but-unconfirmed VAT row to the profile instead of asking for another upload", async () => {
    const onEditProfile = vi.fn();
    const onUpload = vi.fn();
    const s = seller({ missingDocumentCategories: ["VAT_CERTIFICATE_OR_DECLARATION"] });
    renderWithApp([{ path: "/", element: <KycChecklist seller={s} docs={[doc("VAT_NON_REGISTRATION_DECLARATION")]} canEdit onUpload={onUpload} onEditProfile={onEditProfile} /> }], "/");
    const row = (await screen.findByText("VAT non-registration declaration")).closest("li")!;
    expect(within(row).getByText("Uploaded · confirm in profile")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /Upload/ })).not.toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: "Confirm in profile" }));
    expect(onEditProfile).toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("pre-fills empty licence fields from the newest uploaded trade licence", async () => {
    const hint = licenceFromDocuments([
      doc("TRADE_LICENSE", { sellerDocumentId: "old", createdAtUtc: "2026-09-01T00:00:00", expiresAt: "2027-01-01T00:00:00Z" }),
      doc("TRADE_LICENSE", { sellerDocumentId: "new", createdAtUtc: "2026-10-28T00:00:00", documentNumber: "CN-1234", expiresAt: "2028-11-29T00:00:00Z" }),
    ]);
    expect(hint).toEqual({ number: "CN-1234", issuedAt: undefined, expiresAt: "2028-11-29T00:00:00Z" });
    renderWithApp([{ path: "/", element: <BusinessProfileDialog seller={seller()} open onOpenChange={() => {}} licenceHint={hint} /> }], "/");
    const dialog = await screen.findByRole("dialog", { name: "Business profile" });
    expect(within(dialog).getByLabelText(/Licence expires on/)).toHaveValue("2028-11-29");
    expect(within(dialog).getByLabelText(/Trade licence no/)).toHaveValue("CN-1234");
    expect(within(dialog).getByText(/filled in from the trade licence you uploaded/)).toBeInTheDocument();
  });
});

describe("Add document dialog", () => {
  it("reloads the seller record after an upload so the checklist and Submit reflect the server's new completeness", async () => {
    const upload = vi.spyOn(filesService, "upload").mockResolvedValue({ fileId: "f-9" } as Awaited<ReturnType<typeof filesService.upload>>);
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    mockFetch([
      { method: "POST", path: "/api/v1/marketplace/sellers/s-1/documents", respond: () => ({ body: { success: true, data: doc("VAT_DECLARATION") } }) },
      { method: "GET", path: "/api/v1/marketplace/sellers/s-1/documents", respond: () => ({ body: { success: true, data: [] } }) },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ path: "/", element: <AddDocumentDialog sellerId="s-1" open onOpenChange={() => {}} vatRegistered={false} initialCategory="VAT" /> }], "/");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: /Document type/ }));
    await user.click(await screen.findByRole("option", { name: "VAT declaration" }));
    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, new File(["x"], "decl.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Upload & add" }));
    await waitFor(() => expect(invalidate.mock.calls.some(([f]) => JSON.stringify(f?.queryKey) === JSON.stringify(sellerKeys.seller("s-1")))).toBe(true));
    invalidate.mockRestore();
    upload.mockRestore();
  });

  it("opened from the Signatory authority row, offers only authority documents with power of attorney preselected", async () => {
    mockFetch([{ method: "GET", path: "/api/v1/marketplace/sellers/s-1/documents", respond: () => ({ body: { success: true, data: [] } }) }]);
    renderWithApp([{ path: "/", element: <AddDocumentDialog sellerId="s-1" open onOpenChange={() => {}} initialCategory="SIGNATORY" signatoryPart="AUTHORITY" /> }], "/");
    const dialog = await screen.findByRole("dialog");
    const values = Array.from(dialog.querySelectorAll("select option")).map((o) => (o as HTMLOptionElement).value).filter((v) => v && !v.startsWith("__"));
    expect(values).toContain("SIGNATORY_POA");
    expect(values).not.toContain("SIGNATORY_EMIRATES_ID");
    expect(values).not.toContain("SIGNATORY_PASSPORT");
    expect((dialog.querySelector("select") as HTMLSelectElement).value).toBe("SIGNATORY_POA");
  });

  it("only offers declarations for a non-VAT business and requires combined signatory files to declare their contents", async () => {
    const upload = vi.spyOn(filesService, "upload").mockResolvedValue({ fileId: "f-9" } as Awaited<ReturnType<typeof filesService.upload>>);
    let posted: Record<string, unknown> | null = null;
    mockFetch([
      {
        method: "POST",
        path: "/api/v1/marketplace/sellers/s-1/documents",
        respond: ({ body }) => ((posted = body as Record<string, unknown>), { body: { success: true, data: doc("SIGNATORY_POA_OR_PASSPORT") } }),
      },
      { method: "GET", path: "/api/v1/marketplace/sellers/s-1/documents", respond: () => ({ body: { success: true, data: [] } }) },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ path: "/", element: <AddDocumentDialog sellerId="s-1" open onOpenChange={() => {}} vatRegistered={false} initialCategory="VAT" /> }], "/");
    const dialog = await screen.findByRole("dialog");
    const vatOptions = Array.from(dialog.querySelectorAll("select option")).map((o) => (o as HTMLOptionElement).value).filter((v) => v && !v.startsWith("__"));
    expect([...new Set(vatOptions)]).toEqual(["VAT_NON_REGISTRATION_DECLARATION", "NON_VAT_DECLARATION", "VAT_DECLARATION"]);

    await user.click(within(dialog).getByRole("radio", { name: "Signatory" }));
    await user.click(within(dialog).getByRole("combobox", { name: /Document type/ }));
    await user.click(await screen.findByRole("option", { name: "Combined: ID and authority proof in one file" }));
    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, new File(["x"], "poa.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Upload & add" }));
    expect(await within(dialog).findByText("Tick what this file contains.")).toBeInTheDocument();
    expect(posted).toBeNull();

    await user.click(within(dialog).getByRole("checkbox", { name: /Emirates ID or passport/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Proof of authority/ }));
    await user.click(screen.getByRole("button", { name: "Upload & add" }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ documentType: "SIGNATORY_POA_OR_PASSPORT", fileAssetId: "f-9", containsSignatoryId: true, containsSignatoryAuthorityProof: true });
    upload.mockRestore();
  });
});

describe("Business profile dialog", () => {
  it("requires a future licence expiry and a 15-digit TRN, then saves with a fresh row version", async () => {
    let put: Record<string, unknown> | null = null;
    mockFetch([
      { method: "GET", path: "/api/v1/marketplace/sellers/s-1", respond: () => ({ body: { success: true, data: seller({ rowVersion: "AAAAAAAAAAk=" }) } }) },
      {
        method: "PUT",
        path: "/api/v1/marketplace/sellers/s-1/profile",
        respond: ({ body }) => ((put = body as Record<string, unknown>), { body: { success: true, data: seller() } }),
      },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ path: "/", element: <BusinessProfileDialog seller={seller()} open onOpenChange={() => {}} /> }], "/");
    const dialog = await screen.findByRole("dialog", { name: "Business profile" });
    await user.type(within(dialog).getByLabelText(/Trade licence no/), "FZ-88392");
    await user.type(within(dialog).getByLabelText(/Issuing authority/), "HFZA");
    await user.click(within(dialog).getByRole("switch", { name: "VAT registered" }));
    await user.type(within(dialog).getByLabelText(/TRN/), "12345");
    await user.type(within(dialog).getByLabelText(/IBAN/), "ae07 0331 2345 6789 0123 456");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await within(dialog).findByText("Enter the licence expiry date.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the 15-digit TRN.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Licence expires on/), "2099-05-31");
    await user.clear(within(dialog).getByLabelText(/TRN/));
    await user.type(within(dialog).getByLabelText(/TRN/), "100998877600003");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(put).not.toBeNull());
    expect(put).toMatchObject({
      tradeLicenseNumber: "FZ-88392",
      issuingAuthority: "HFZA",
      tradeLicenseExpiresAtUtc: "2099-05-31T00:00:00Z",
      isVatRegistered: true,
      taxRegistrationNumber: "100998877600003",
      hasVatDeclaration: false,
      bankIban: "AE070331234567890123456",
      expectedRowVersion: "AAAAAAAAAAk=",
    });
  });
});
