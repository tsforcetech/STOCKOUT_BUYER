import { http } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { expectArray, unwrapData, type Envelope } from "@/lib/api/envelope";
import type {
  CreateSellerDocumentRequest,
  CreateSellerRequest,
  MarketplaceCurrentActorResponse,
  MarketplaceSellerDto,
  SellerDocumentResponse,
  SellerEligibilityResponse,
  BuyerEligibilityResponse,
  UpdateSellerProfileRequest,
  UserProfileResponse,
  UpdateUserProfileRequest,
} from "@/api/types/user-organization";

/**
 * user-organization marketplace self-service. Success: { success, data }.
 * Access is by seller membership; non-members get 403 { code: "MARKETPLACE_SELLER_ACCESS_DENIED" }.
 * Contract: docs/contracts/seller-account.md
 */
const seg = encodeURIComponent;
const get = async <T>(path: string, signal?: AbortSignal) => unwrapData<T>(await http.get<Envelope<T>>(path, { signal }));
const post = async <T>(path: string, body?: unknown) => unwrapData<T>(await http.post<Envelope<T>>(path, body));

export const marketplaceService = {
  /** Read by the always-mounted header: normalised so a malformed body becomes actorError, not a render crash. */
  actorsMe: async (signal?: AbortSignal): Promise<MarketplaceCurrentActorResponse> => {
    const actor = await get<MarketplaceCurrentActorResponse | null>("/api/v1/marketplace/actors/me", signal);
    if (!actor || typeof actor !== "object") throw new ApiError({ kind: "server", status: 200, message: "The server returned an unexpected response.", body: actor });
    return { ...actor, sellerContexts: expectArray(actor.sellerContexts) };
  },

  createSeller: (body: CreateSellerRequest) => post<MarketplaceSellerDto>("/api/v1/marketplace/sellers", body),
  seller: (sellerId: string, signal?: AbortSignal) => get<MarketplaceSellerDto>(`/api/v1/marketplace/sellers/${seg(sellerId)}`, signal),
  updateSellerProfile: async (sellerId: string, body: UpdateSellerProfileRequest) =>
    unwrapData<MarketplaceSellerDto>(await http.put<Envelope<MarketplaceSellerDto>>(`/api/v1/marketplace/sellers/${seg(sellerId)}/profile`, body)),
  eligibility: (sellerId: string, signal?: AbortSignal) => get<SellerEligibilityResponse>(`/api/v1/marketplace/sellers/${seg(sellerId)}/eligibility`, signal),
  /** BK-1: buying needs no buyer KYC; this only says whether this account may buy. Not a checkout API. */
  buyerEligibility: (signal?: AbortSignal) => get<BuyerEligibilityResponse>("/api/v1/marketplace/buyer/eligibility", signal),
  submitSeller: (sellerId: string, expectedRowVersion: string) => post<MarketplaceSellerDto>(`/api/v1/marketplace/sellers/${seg(sellerId)}/submit`, { expectedRowVersion }),

  documents: (sellerId: string, signal?: AbortSignal) => get<SellerDocumentResponse[]>(`/api/v1/marketplace/sellers/${seg(sellerId)}/documents`, signal),
  addDocument: (sellerId: string, body: CreateSellerDocumentRequest) => post<SellerDocumentResponse>(`/api/v1/marketplace/sellers/${seg(sellerId)}/documents`, body),
  /** Backend defect: returns 404 even after a successful delete — callers should refetch either way. */
  deleteDocument: (sellerId: string, documentId: string) => http.delete<unknown>(`/api/v1/marketplace/sellers/${seg(sellerId)}/documents/${seg(documentId)}`),

  myProfile: (signal?: AbortSignal) => get<UserProfileResponse>("/api/v1/users/me", signal),
  updateMyProfile: async (body: UpdateUserProfileRequest) => unwrapData<UserProfileResponse>(await http.put<Envelope<UserProfileResponse>>("/api/v1/users/me", body)),
};
