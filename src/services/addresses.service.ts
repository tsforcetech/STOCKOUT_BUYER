import { http } from "@/lib/api/client";
import { unwrapData, type Envelope } from "@/lib/api/envelope";
import type { BuyerDeliveryAddressDto, BuyerDeliveryAddressPageDto, SaveBuyerDeliveryAddressRequest } from "@/api/types/addresses";

const seg = encodeURIComponent;

/** Who owns the address book: the individual buyer (server derives it from the token) or an authorised organisation. */
export type AddressOwner = { kind: "individual" } | { kind: "organization"; organizationId: string };

export const addressBase = (owner: AddressOwner) =>
  owner.kind === "individual" ? "/api/v1/marketplace/buyer/addresses" : `/api/v1/marketplace/buyer/organizations/${seg(owner.organizationId)}/addresses`;

export const ADDRESS_PAGE_SIZE = 20;

/**
 * COM-ADDR-01. Create sends an Idempotency-Key (reuse the same key + body on a retry); update sends If-Match with the
 * rowVersion. Delete is a soft deactivation. Never put address PII in query strings.
 */
export const addressesService = {
  list: async (owner: AddressOwner, page: number, includeInactive: boolean, signal?: AbortSignal) =>
    unwrapData<BuyerDeliveryAddressPageDto>(await http.get<Envelope<BuyerDeliveryAddressPageDto>>(addressBase(owner), { query: { includeInactive, page, pageSize: ADDRESS_PAGE_SIZE }, signal })),
  get: async (owner: AddressOwner, addressId: string, signal?: AbortSignal) =>
    unwrapData<BuyerDeliveryAddressDto>(await http.get<Envelope<BuyerDeliveryAddressDto>>(`${addressBase(owner)}/${seg(addressId)}`, { signal })),
  create: async (owner: AddressOwner, body: SaveBuyerDeliveryAddressRequest, idempotencyKey: string) =>
    unwrapData<BuyerDeliveryAddressDto>(await http.post<Envelope<BuyerDeliveryAddressDto>>(addressBase(owner), body, { headers: { "Idempotency-Key": idempotencyKey } })),
  update: async (owner: AddressOwner, addressId: string, body: SaveBuyerDeliveryAddressRequest, rowVersion: string) =>
    unwrapData<BuyerDeliveryAddressDto>(await http.put<Envelope<BuyerDeliveryAddressDto>>(`${addressBase(owner)}/${seg(addressId)}`, body, { headers: { "If-Match": `"${rowVersion}"` } })),
  deactivate: async (owner: AddressOwner, addressId: string, rowVersion?: string) =>
    unwrapData<BuyerDeliveryAddressDto>(
      await http.delete<Envelope<BuyerDeliveryAddressDto>>(`${addressBase(owner)}/${seg(addressId)}`, { headers: rowVersion ? { "If-Match": `"${rowVersion}"` } : undefined }),
    ),
  setDefault: async (owner: AddressOwner, addressId: string) =>
    unwrapData<BuyerDeliveryAddressDto>(await http.post<Envelope<BuyerDeliveryAddressDto>>(`${addressBase(owner)}/${seg(addressId)}/default`)),
};

export const addressKeys = {
  all: ["buyer", "addresses"] as const,
  list: (owner: AddressOwner, page: number, includeInactive: boolean) => ["buyer", "addresses", owner.kind === "individual" ? "me" : owner.organizationId, page, includeInactive] as const,
  active: (owner: AddressOwner) => ["buyer", "addresses", owner.kind === "individual" ? "me" : owner.organizationId, "active-all"] as const,
};
