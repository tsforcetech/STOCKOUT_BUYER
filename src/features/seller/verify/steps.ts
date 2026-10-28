import type { MarketplaceSellerDto, SellerDocumentResponse } from "@/api/types/user-organization";
import { categoryOf, signatoryParts } from "../lib/kyc";

/**
 * Seller verification wizard: one short step per topic, each document uploaded next to its details.
 * Completeness always comes from the server (profile fields + missingDocumentCategories), never guessed.
 */
export const STEPS = [
  { key: "company", title: "Company", short: "Company" },
  { key: "vat", title: "VAT", short: "VAT" },
  { key: "signatory", title: "Authorised signatory", short: "Signatory" },
  { key: "bank", title: "Bank account", short: "Bank" },
  { key: "review", title: "Review and submit", short: "Submit" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

/** UAE licensing authorities for the "issued by" suggestions (free text is still accepted). */
export const ISSUING_AUTHORITIES = [
  "Dubai DET (Department of Economy and Tourism)",
  "Abu Dhabi ADDED",
  "Sharjah SEDD",
  "Ajman DED",
  "Ras Al Khaimah DED",
  "Umm Al Quwain DED",
  "Fujairah DED",
  "JAFZA",
  "DMCC",
  "DAFZA",
  "Dubai South",
  "SAIF Zone",
  "Hamriyah Free Zone",
  "RAKEZ",
  "IFZA",
  "Meydan Free Zone",
  "ADGM",
  "KEZAD",
];
export const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

/** Documents that still count (not rejected, not expired). */
export function liveDocs(docs: SellerDocumentResponse[]): SellerDocumentResponse[] {
  const now = Date.now();
  return docs.filter((d) => d.verificationStatus !== "REJECTED" && !(d.expiresAt && Date.parse(d.expiresAt) <= now));
}

export function newest(docs: SellerDocumentResponse[]): SellerDocumentResponse | undefined {
  return [...docs].sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc))[0];
}

export function docsFor(docs: SellerDocumentResponse[], cat: "TRADE_LICENSE" | "VAT" | "BANK"): SellerDocumentResponse[] {
  return liveDocs(docs).filter((d) => categoryOf(d.documentType) === cat);
}

export function signatoryDocs(docs: SellerDocumentResponse[], part: "id" | "authority"): SellerDocumentResponse[] {
  return liveDocs(docs).filter((d) => categoryOf(d.documentType) === "SIGNATORY" && signatoryParts(d)[part]);
}

const has = (v: string | null | undefined) => !!v && v.trim().length > 0;

export function stepDone(key: StepKey, s: MarketplaceSellerDto): boolean {
  const missing = new Set((s.missingDocumentCategories ?? []).map((c) => c.toUpperCase()));
  switch (key) {
    case "company":
      return (
        has(s.legalName) &&
        has(s.tradeLicenseNumber ?? s.registrationNo) &&
        has(s.issuingAuthority) &&
        !!s.tradeLicenseExpiresAtUtc &&
        Date.parse(s.tradeLicenseExpiresAtUtc) > Date.now() &&
        has(s.stateOrEmirate) &&
        !missing.has("TRADE_LICENSE")
      );
    case "vat":
      return (s.isVatRegistered ? has(s.taxRegistrationNumber) : !!s.hasVatDeclaration) && !missing.has("VAT_CERTIFICATE_OR_DECLARATION");
    case "signatory":
      return has(s.signatoryName) && !["SIGNATORY_ID_AND_AUTHORITY", "SIGNATORY_IDENTITY", "SIGNATORY_AUTHORITY_PROOF"].some((c) => missing.has(c));
    case "bank":
      return has(s.bankIban) && !missing.has("BANK_IBAN_LETTER");
    case "review":
      return s.onboardingStatus !== "DRAFT" && s.verificationStatus !== "REJECTED";
  }
}

/** Where to resume: the first step that isn't done yet (review when everything else is). */
export function firstOpenStep(s: MarketplaceSellerDto): StepKey {
  return STEPS.find((st) => st.key !== "review" && !stepDone(st.key, s))?.key ?? "review";
}
