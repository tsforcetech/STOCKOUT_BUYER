/**
 * COM-ADDR-01 buyer delivery address book (user-organization, commit 2feeb05):
 *   Emcore.UserOrganization.Contracts/Marketplace/BuyerAddressContracts.cs, MarketplaceBuyerAddressesController.cs.
 * B2C base: /api/v1/marketplace/buyer/addresses · B2B base: /api/v1/marketplace/buyer/organizations/{organizationId}/addresses.
 * Responses use the { success, data } envelope; errors are ProblemDetails with `code`.
 */
type Guid = string;

export type AddressStatus = "ACTIVE" | "INACTIVE";

export interface BuyerDeliveryAddressDto {
  addressId: Guid;
  ownerOrganizationId: Guid;
  label: string;
  contactName: string;
  contactPhone: string;
  siteName: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  /** ISO alpha-3 */
  countryCode: string;
  stateOrEmirate: string;
  city: string;
  area: string;
  street: string | null;
  building: string | null;
  unit: string | null;
  postalCode: string | null;
  deliveryNotes: string | null;
  /** BE-13 map pin (WGS84, ≤ 6 decimals). Required together on create; null on legacy pinless addresses. */
  latitude: number | null;
  longitude: number | null;
  /** Optional provider place reference (≤ 200 chars) and the address text the map showed (≤ 500 chars). */
  mapPlaceId: string | null;
  mapFormattedAddress: string | null;
  isDefault: boolean;
  status: AddressStatus | string;
  version: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  deactivatedAtUtc: string | null;
  /** base64 rowversion: send as If-Match on update (and optionally on deactivate). */
  rowVersion: string;
}

/** SaveBuyerDeliveryAddressRequest. `isDefault` only counts on create; edits use POST …/default. */
export interface SaveBuyerDeliveryAddressRequest {
  label: string;
  contactName: string;
  contactPhone: string;
  siteName: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  countryCode: string;
  stateOrEmirate: string;
  city: string;
  area: string;
  street: string | null;
  building: string | null;
  unit: string | null;
  postalCode: string | null;
  deliveryNotes: string | null;
  /** BE-13 map pin (WGS84, ≤ 6 decimals). Required together on create; null on legacy pinless addresses. */
  latitude: number | null;
  longitude: number | null;
  /** Optional provider place reference (≤ 200 chars) and the address text the map showed (≤ 500 chars). */
  mapPlaceId: string | null;
  mapFormattedAddress: string | null;
  isDefault: boolean;
}

export interface BuyerDeliveryAddressPageDto {
  items: BuyerDeliveryAddressDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Provisional owner policy (OD-ADDR-03): the seven canonical emirates accepted for countryCode ARE. */
export const UAE_EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"] as const;
