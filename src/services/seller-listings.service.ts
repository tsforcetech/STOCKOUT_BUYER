import { http } from "@/lib/api/client";
import type {
  PagedSellerCorrectionsResponse,
  SellerCorrectionDecisionRequest,
  SellerCorrectionDecisionResponse,
  SellerCorrectionsQuery,
  SellerListingCorrectionDto,
} from "@/api/types/listing-corrections";
import { isApiError } from "@/lib/api/errors";
import { unwrapData, type Envelope } from "@/lib/api/envelope";
import type {
  AdjustListingInventoryRequest,
  ArchiveListingResponse,
  AttachListingMediaRequest,
  AttachListingMediaResponse,
  CreateListingDraftRequest,
  CreateListingDraftResponse,
  EffectiveCategoryAttributeResponse,
  EffectiveCategoryBrandResponse,
  InspectionDetailDto,
  InventoryMovementsQuery,
  ListingAttributesResponse,
  ListingDetailResponse,
  ListingInventoryMovementsResponse,
  ListingInventoryResponse,
  ListingMediaMutationResponse,
  ListingMediaResponse,
  ListingModerationStatusResponse,
  ListingRequirementsResponse,
  PagedInspectionQueueResponse,
  PublicCategoryConditionsResponse,
  PublicCategoryUnitsResponse,
  ReplaceListingAttributesRequest,
  RepublishListingResponse,
  SellerInspectionsQuery,
  SellerListingListQuery,
  SellerListingListResponse,
  SetListingInventoryRequest,
  SubmitListingRequest,
  SubmitListingResponse,
  CreateListingRevisionResponse,
  SuspendListingResponse,
  UpdateListingDraftRequest,
  UpdateListingDraftResponse,
  ValidateListingResponse,
} from "@/api/types/seller-listings";

/**
 * Seller self-service listings (catalog-listing, gateway /api/v1/marketplace/sellers/{sellerId}/listings).
 * Seller endpoints return BARE DTOs; errors are { error, message }. Public taxonomy reads use { success, data }.
 * Contract: docs/contracts/seller-listings.md
 */
const seg = encodeURIComponent;
const base = (sellerId: string) => `/api/v1/marketplace/sellers/${seg(sellerId)}/listings`;
const one = (sellerId: string, listingId: string) => `${base(sellerId)}/${seg(listingId)}`;
const taxonomy = async <T>(path: string, signal?: AbortSignal) => unwrapData<T>(await http.get<Envelope<T>>(path, { signal, auth: false }));
const cat = (categoryId: string) => `/api/v1/catalog/categories/${seg(categoryId)}`;

export const sellerListingsService = {
  // L2 / L3 / L1 / L4
  list: (sellerId: string, query: SellerListingListQuery, signal?: AbortSignal) =>
    http.get<SellerListingListResponse>(base(sellerId), { signal, query: { ...query } }),
  detail: (sellerId: string, listingId: string, signal?: AbortSignal) => http.get<ListingDetailResponse>(one(sellerId, listingId), { signal }),
  /** X-Idempotency-Key is required (≤100 chars); keep the same key when retrying the same body. */
  create: (sellerId: string, body: CreateListingDraftRequest, idempotencyKey: string) =>
    http.post<CreateListingDraftResponse>(base(sellerId), body, { idempotencyKey }),
  update: (sellerId: string, listingId: string, body: UpdateListingDraftRequest) => http.put<UpdateListingDraftResponse>(one(sellerId, listingId), body),

  /** L22: copy the live version into a new draft. The published version stays live until the draft is approved and published. */
  createRevision: (sellerId: string, listingId: string) => http.post<CreateListingRevisionResponse>(`${one(sellerId, listingId)}/revision`),

  // L5–L10
  /** X-Idempotency-Key is required but ignored by the backend (defect D6). */
  submit: (sellerId: string, listingId: string, body: SubmitListingRequest, idempotencyKey: string) =>
    http.post<SubmitListingResponse>(`${one(sellerId, listingId)}/submit`, body, { idempotencyKey }),
  moderationStatus: (sellerId: string, listingId: string, signal?: AbortSignal) =>
    http.get<ListingModerationStatusResponse>(`${one(sellerId, listingId)}/moderation-status`, { signal }),
  validate: (sellerId: string, listingId: string) => http.post<ValidateListingResponse>(`${one(sellerId, listingId)}/validate`),
  pause: (sellerId: string, listingId: string, expectedRowVersion: string, remarks: string | null) =>
    http.post<SuspendListingResponse>(`${one(sellerId, listingId)}/pause`, { remarks, expectedRowVersion }),
  resume: (sellerId: string, listingId: string, expectedRowVersion: string) =>
    http.post<RepublishListingResponse>(`${one(sellerId, listingId)}/resume`, { expectedRowVersion }),
  archive: (sellerId: string, listingId: string, expectedRowVersion: string) =>
    http.post<ArchiveListingResponse>(`${one(sellerId, listingId)}/archive`, { expectedRowVersion }),

  // A1 / A2
  attributes: (sellerId: string, listingId: string, signal?: AbortSignal) => http.get<ListingAttributesResponse>(`${one(sellerId, listingId)}/attributes`, { signal }),
  replaceAttributes: (sellerId: string, listingId: string, body: ReplaceListingAttributesRequest) =>
    http.put<ListingAttributesResponse>(`${one(sellerId, listingId)}/attributes`, body),

  // M1–M5
  media: (sellerId: string, listingId: string, signal?: AbortSignal) => http.get<ListingMediaResponse>(`${one(sellerId, listingId)}/media`, { signal }),
  attachMedia: (sellerId: string, listingId: string, body: AttachListingMediaRequest) => http.post<AttachListingMediaResponse>(`${one(sellerId, listingId)}/media`, body),
  reorderMedia: (sellerId: string, listingId: string, expectedRowVersion: string, orderedFileAssetIds: string[]) =>
    http.put<ListingMediaMutationResponse>(`${one(sellerId, listingId)}/media/order`, { expectedRowVersion, orderedFileAssetIds }),
  /** DELETE carries a JSON body (required by the backend). */
  deleteMedia: (sellerId: string, listingId: string, fileAssetId: string, expectedRowVersion: string) =>
    http.delete<ListingMediaMutationResponse>(`${one(sellerId, listingId)}/media/${seg(fileAssetId)}`, { body: { expectedRowVersion } }),
  setPrimaryMedia: (sellerId: string, listingId: string, fileAssetId: string, expectedRowVersion: string) =>
    http.put<ListingMediaMutationResponse>(`${one(sellerId, listingId)}/media/${seg(fileAssetId)}/primary`, { expectedRowVersion }),

  // I1–I4 (separate inventory rowVersion)
  inventory: (sellerId: string, listingId: string, signal?: AbortSignal) => http.get<ListingInventoryResponse>(`${one(sellerId, listingId)}/inventory`, { signal }),
  setInventory: (sellerId: string, listingId: string, body: SetListingInventoryRequest) => http.put<ListingInventoryResponse>(`${one(sellerId, listingId)}/inventory`, body),
  adjustInventory: (sellerId: string, listingId: string, body: AdjustListingInventoryRequest) =>
    http.post<ListingInventoryResponse>(`${one(sellerId, listingId)}/inventory/adjustments`, body),
  movements: (sellerId: string, listingId: string, query: InventoryMovementsQuery, signal?: AbortSignal) =>
    http.get<ListingInventoryMovementsResponse>(`${one(sellerId, listingId)}/inventory/movements`, { signal, query: { ...query } }),

  // S1–S3
  inspections: (sellerId: string, listingId: string, query: SellerInspectionsQuery, signal?: AbortSignal) =>
    http.get<PagedInspectionQueueResponse>(`${one(sellerId, listingId)}/inspections`, { signal, query: { ...query } }),
  /** Returns null when no inspection exists (backend answers 404 with an empty body). */
  latestInspection: async (sellerId: string, listingId: string, signal?: AbortSignal): Promise<InspectionDetailDto | null> => {
    try {
      return await http.get<InspectionDetailDto>(`${one(sellerId, listingId)}/inspections/latest`, { signal });
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null;
      throw error;
    }
  },
  /** 202 with an empty body. */
  // E5 inspector corrections (no envelope). Seller-wide list is the only discovery mechanism (no inbox).
  corrections: (sellerId: string, query: SellerCorrectionsQuery, signal?: AbortSignal) =>
    http.get<PagedSellerCorrectionsResponse>(`${base(sellerId)}/corrections`, { signal, query: { listingId: query.listingId, status: query.status, page: query.page, pageSize: query.pageSize } }),
  listingCorrections: (sellerId: string, listingId: string, query: Omit<SellerCorrectionsQuery, "listingId">, signal?: AbortSignal) =>
    http.get<PagedSellerCorrectionsResponse>(`${one(sellerId, listingId)}/corrections`, { signal, query: { status: query.status, page: query.page, pageSize: query.pageSize } }),
  correction: (sellerId: string, listingId: string, correctionId: string, signal?: AbortSignal) =>
    http.get<SellerListingCorrectionDto>(`${one(sellerId, listingId)}/corrections/${seg(correctionId)}`, { signal }),
  decideCorrection: (sellerId: string, listingId: string, correctionId: string, body: SellerCorrectionDecisionRequest) =>
    http.post<SellerCorrectionDecisionResponse>(`${one(sellerId, listingId)}/corrections/${seg(correctionId)}/decision`, body),
  requestReinspection: (sellerId: string, listingId: string, inspectionId: string, remediationNotes: string) =>
    http.post<unknown>(`${one(sellerId, listingId)}/inspections/${seg(inspectionId)}/request-reinspection`, { remediationNotes }),

  // P3–P7 public taxonomy reads ({ success, data })
  listingRequirements: (categoryId: string, signal?: AbortSignal) => taxonomy<ListingRequirementsResponse>(`${cat(categoryId)}/listing-requirements`, signal),
  categoryAttributes: (categoryId: string, signal?: AbortSignal) => taxonomy<EffectiveCategoryAttributeResponse[]>(`${cat(categoryId)}/attributes`, signal),
  categoryBrands: (categoryId: string, signal?: AbortSignal) => taxonomy<EffectiveCategoryBrandResponse[]>(`${cat(categoryId)}/brands`, signal),
  categoryConditions: (categoryId: string, signal?: AbortSignal) => taxonomy<PublicCategoryConditionsResponse>(`${cat(categoryId)}/conditions`, signal),
  categoryUnits: (categoryId: string, signal?: AbortSignal) => taxonomy<PublicCategoryUnitsResponse>(`${cat(categoryId)}/units`, signal),
};
