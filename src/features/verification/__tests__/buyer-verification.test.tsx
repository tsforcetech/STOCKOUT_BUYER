import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import BuyerVerificationPage from "../buyer-verification-page";
import { filesService } from "@/services/files.service";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const signIn = () => {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
};
const profile = (over: Record<string, unknown> = {}) => ({
  buyerId: "b-1", organizationId: "o-1", organizationType: "INDIVIDUAL", legalName: null, tradingName: null, tradeLicenseNumber: null, issuingAuthority: null,
  tradeLicenseIssuedAtUtc: null, tradeLicenseExpiresAtUtc: null, isVatRegistered: false, taxRegistrationNumber: null, hasVatDeclaration: false, signatoryName: null,
  signatoryEmail: null, signatoryPhone: null, signatoryAuthorityRole: null, businessContactEmail: null, businessContactPhone: null, addressLine1: null, addressLine2: null,
  city: null, stateOrEmirate: null, postalCode: null, countryCode: "ARE", defaultCurrency: "AED", bankName: null, bankAccountNumber: null, bankIban: null, bankSwiftCode: null,
  bankBeneficiaryName: null, verificationStatus: "DRAFT", orgStatus: "ACTIVE", submittedAtUtc: null, verifiedAtUtc: null, rejectedAtUtc: null, suspendedAtUtc: null,
  rejectionReason: null, suspensionReason: null, canPurchase: false, mandatoryDocumentsComplete: false, missingDocumentCategories: [], pendingPolicies: [], documents: [],
  createdAtUtc: "2026-11-06T08:00:00Z", updatedAtUtc: "2026-11-06T08:00:00Z", rowVersion: "AAAAAAAAD00=", accountHolderUserId: "u-1", fullName: "Aisha Rahman", nationality: "ARE",
  documentType: "EMIRATES_ID", documentNumber: "784-1990-1234567-1", issuingCountry: "ARE", documentExpiresAtUtc: "2029-01-01T00:00:00Z", mobileNumber: "+971501234567",
  residentialAddress: "Villa 12, Al Barsha, Dubai", requiresReverification: false, reverificationReason: null, reverificationRequiredAtUtc: null, ...over,
});
const doc = (over: Record<string, unknown> = {}) => ({
  buyerDocumentId: "d-1", buyerId: "b-1", documentType: "EMIRATES_ID", fileAssetId: "f-1", documentNumber: "784-1990-1234567-1", issuedAt: null, expiresAt: "2029-01-01T00:00:00Z",
  verificationStatus: "PENDING", reviewRemark: null, containsSignatoryId: null, containsSignatoryAuthorityProof: null, verifiedSignatoryId: null, verifiedSignatoryAuthorityProof: null,
  reviewedByUserId: null, reviewedAtUtc: null, createdAtUtc: "2026-11-06T09:00:00Z", ...over,
});
const env = (data: unknown) => ({ body: { success: true, data } });
const eligibility = { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => env({ buyerId: "b-1", eligible: false, verificationStatus: "DRAFT", canPurchase: false, reason: "Identity verification required." }) };
const common = [...sessionRoutes([]), eligibility, { method: "GET", path: "/api/v1/policies/me/pending", respond: () => env([]) }];
const page = () => renderWithApp([{ element: <RequireAuth />, children: [{ path: "/account/verification", element: <BuyerVerificationPage /> }] }, { path: "/login", element: <div>login</div> }], "/account/verification");

describe("Buyer identity verification (one ID, handoff 2026-11-06)", () => {
  it("new buyer: saves the seven identity details with the exact PUT body", async () => {
    signIn();
    let saved: unknown = null;
    const { calls } = mockFetch([
      ...common,
      { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => (saved ? env(profile()) : { status: 404, body: { status: 404, title: "Not Found", code: "MARKETPLACE_BUYER_NOT_FOUND" } }) },
      { method: "GET", path: "/api/v1/marketplace/buyer/documents", respond: () => env([]) },
      { method: "PUT", path: "/api/v1/marketplace/buyer/profile", respond: ({ body }) => ((saved = body), env(profile())) },
    ]);
    page();
    expect(await screen.findByText("Complete identity verification")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("Enter your full name as on your ID.")).toBeInTheDocument();
    expect(saved).toBeNull();

    await userEvent.type(screen.getByLabelText(/Full name/), "Aisha Rahman");
    const pick = async (field: RegExp, option: string) => {
      await userEvent.click(screen.getByRole("combobox", { name: field }));
      await userEvent.click(await screen.findByRole("option", { name: option }));
    };
    await pick(/Nationality/, "United Arab Emirates");
    await pick(/ID type/, "Emirates ID");
    await userEvent.type(screen.getByLabelText(/ID number/), "784-1990-1234567-1");
    await pick(/Issuing country/, "United Arab Emirates");
    await userEvent.type(screen.getByLabelText(/ID expiry date/), "2029-01-01");
    await userEvent.type(screen.getByLabelText(/Mobile number/), "+971501234567");
    await userEvent.type(screen.getByLabelText(/Residential address/), "Villa 12, Al Barsha, Dubai");
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() =>
      expect(saved).toEqual({
        organizationType: "INDIVIDUAL", fullName: "Aisha Rahman", nationality: "ARE", documentType: "EMIRATES_ID", documentNumber: "784-1990-1234567-1", issuingCountry: "ARE",
        documentExpiresAtUtc: "2029-01-01T00:00:00Z", mobileNumber: "+971501234567", residentialAddress: "Villa 12, Al Barsha, Dubai", expectedRowVersion: null,
      }),
    );
    expect(await screen.findByRole("button", { name: "Choose file" })).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.endsWith("/buyer/submit"))).toBe(false);
  });

  it("uploads the ID privately (BUYER_DOCUMENT) and attaches it with expiresAt, then submits with only a fresh rowVersion", async () => {
    signIn();
    let docs: unknown[] = [];
    let attached: unknown = null;
    let submitted: unknown = null;
    const upload = vi.spyOn(filesService, "upload").mockResolvedValue({ fileId: "f-9", purpose: "BUYER_DOCUMENT", originalFileName: "id.pdf", actualContentType: "application/pdf", actualSizeBytes: 1000, status: "AVAILABLE", createdAtUtc: "", completedAtUtc: "" });
    mockFetch([
      ...common,
      { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env(profile({ rowVersion: submitted ? "AAAAAAAAD0Q=" : "AAAAAAAAD0E=", verificationStatus: submitted ? "SUBMITTED" : "DRAFT", submittedAtUtc: submitted ? "2026-11-06T10:00:00Z" : null })) },
      { method: "GET", path: "/api/v1/marketplace/buyer/documents", respond: () => env(docs) },
      { method: "POST", path: "/api/v1/marketplace/buyer/documents", respond: ({ body }) => ((attached = body), (docs = [doc({ fileAssetId: "f-9" })]), env(docs[0])) },
      { method: "POST", path: "/api/v1/marketplace/buyer/submit", respond: ({ body }) => ((submitted = body), env(profile({ verificationStatus: "SUBMITTED", submittedAtUtc: "2026-11-06T10:00:00Z" }))) },
    ]);
    page();
    expect(await screen.findByRole("button", { name: "Submit for review" })).toBeDisabled();
    await screen.findByRole("button", { name: "Choose file" });
    const file = new File(["%PDF"], "id.pdf", { type: "application/pdf" });
    await userEvent.upload(document.getElementById("v-file") as HTMLInputElement, file);
    await waitFor(() => expect(upload).toHaveBeenCalledWith(file, "BUYER_DOCUMENT", expect.anything()));
    await waitFor(() => expect(attached).toEqual({ documentType: "EMIRATES_ID", fileAssetId: "f-9", documentNumber: "784-1990-1234567-1", expiresAt: "2029-01-01T00:00:00Z", issuingCountry: "ARE" }));
    const submit = await screen.findByRole("button", { name: "Submit for review" });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await waitFor(() => expect(submitted).toEqual({ expectedRowVersion: "AAAAAAAAD0E=" }));
    upload.mockRestore();
    expect(await screen.findByText("Under review")).toBeInTheDocument(); // no immediate approval
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("an existing profile without identity details (pre-Q1–Q15) opens the form, keeping the company buyer type", async () => {
    signIn();
    mockFetch([
      ...common,
      { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env(profile({ organizationType: "BUSINESS", fullName: null, documentType: null, documentNumber: null, documentExpiresAtUtc: null, accountHolderUserId: null })) },
      { method: "GET", path: "/api/v1/marketplace/buyer/documents", respond: () => env([]) },
    ]);
    page();
    expect(await screen.findByRole("button", { name: "Save details" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A company" })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(await screen.findByText("Save your details first, then upload your ID.")).toBeInTheDocument();
  });

  it("rejected: shows the reason and the reviewer note, keeps the old file as history and allows a new upload", async () => {
    signIn();
    mockFetch([
      ...common,
      { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env(profile({ verificationStatus: "REJECTED", rejectionReason: "The photo is blurred." })) },
      { method: "GET", path: "/api/v1/marketplace/buyer/documents", respond: () => env([doc({ verificationStatus: "REJECTED", reviewRemark: "Upload a clear copy." })]) },
    ]);
    page();
    expect(await screen.findByText("Verification wasn't approved")).toBeInTheDocument();
    expect(screen.getByText(/Reason: The photo is blurred\./)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Choose file" })).toBeInTheDocument();
    expect(screen.getByText(/Earlier uploads \(1\)/)).toBeInTheDocument();
  });

  it("re-verification: the previous ID must be removed before a new one can be uploaded; submit stays disabled", async () => {
    signIn();
    let docs = [doc({ verificationStatus: "VERIFIED", createdAtUtc: "2026-10-01T00:00:00Z" })];
    const { calls } = mockFetch([
      ...common,
      { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env(profile({ verificationStatus: "VERIFIED", requiresReverification: true, reverificationRequiredAtUtc: "2026-11-05T00:00:00Z" })) },
      { method: "GET", path: "/api/v1/marketplace/buyer/documents", respond: () => env(docs) },
      { method: "DELETE", path: "/api/v1/marketplace/buyer/documents/d-1", respond: () => ((docs = []), env(true)) },
    ]);
    page();
    expect(await screen.findByText("Verification required again")).toBeInTheDocument();
    expect(await screen.findByText("Remove your previous ID first")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose file" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeDisabled();
    await userEvent.click(within(screen.getByRole("list", { name: "Your ID" })).getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    expect(await screen.findByRole("button", { name: "Choose file" })).toBeInTheDocument();
  });

  it("under review: details are read-only and there is nothing to submit", async () => {
    signIn();
    mockFetch([
      ...common,
      { method: "GET", path: "/api/v1/marketplace/buyer/profile", respond: () => env(profile({ verificationStatus: "SUBMITTED", submittedAtUtc: "2026-11-06T10:00:00Z" })) },
      { method: "GET", path: "/api/v1/marketplace/buyer/documents", respond: () => env([doc()]) },
    ]);
    page();
    expect(await screen.findByText("Under review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
  });
});
