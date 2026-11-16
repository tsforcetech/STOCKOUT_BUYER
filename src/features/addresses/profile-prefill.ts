/**
 * What the buyer already gave us during verification, reused in the address form so they don't type it again:
 * the contact (signatory / account holder name and phone) and the company's registered address.
 */
import type { BuyerProfileDto } from "@/api/types/user-organization";
import { ISO_COUNTRIES } from "@/features/verification/countries";
import { toEmirate } from "./geocode";

const t = (v: string | null | undefined) => (v ?? "").trim();

const alpha3 = (code: string | null | undefined) => {
  const c = t(code).toUpperCase();
  return ISO_COUNTRIES.find(([a2, a3]) => a2 === c || a3 === c)?.[1] ?? "";
};

export interface ContactPrefill {
  contactName: string;
  contactPhone: string;
}

export function contactFromProfile(p: BuyerProfileDto | null | undefined): ContactPrefill | null {
  if (!p) return null;
  const contactName = t(p.signatoryName) || t(p.fullName);
  const contactPhone = t(p.businessContactPhone) || t(p.signatoryPhone) || t(p.mobileNumber);
  return contactName || contactPhone ? { contactName, contactPhone } : null;
}

export interface AddressPrefill {
  /** Shown on the button so the buyer sees what will be filled. */
  summary: string;
  label: string;
  countryCode: string;
  stateOrEmirate: string;
  city: string;
  area: string;
  street: string;
  postalCode: string;
}

/** The company's registered address (business buyers), or the account holder's residential address (individuals). */
export function addressFromProfile(p: BuyerProfileDto | null | undefined): AddressPrefill | null {
  if (!p) return null;
  const business = t(p.addressLine1) || t(p.city);
  if (business) {
    const countryCode = alpha3(p.countryCode) || "ARE";
    const emirate = countryCode === "ARE" ? (toEmirate(p.stateOrEmirate) ?? toEmirate(p.city) ?? "") : t(p.stateOrEmirate);
    const company = t(p.tradingName) || t(p.legalName);
    return {
      summary: [t(p.addressLine1), t(p.addressLine2), t(p.city), emirate && emirate !== t(p.city) ? emirate : ""].filter(Boolean).join(", "),
      label: company ? `${company} office` : "Company office",
      countryCode,
      stateOrEmirate: emirate,
      city: t(p.city) || emirate,
      area: t(p.addressLine2),
      street: t(p.addressLine1),
      postalCode: t(p.postalCode),
    };
  }
  const home = t(p.residentialAddress);
  if (home) return { summary: home, label: "Home", countryCode: "ARE", stateOrEmirate: toEmirate(home.split(",").at(-1)) ?? "", city: "", area: "", street: home.slice(0, 200), postalCode: "" };
  return null;
}
