import { http } from "@/lib/api/client";
import type {
  BuyerSavedSearchesListResponse,
  CreateSavedSearchRequest,
  SavedSearch,
  SearchListingsQuery,
  SearchListingsResponse,
  SearchSuggestQuery,
  SearchSuggestionsResponse,
} from "@/api/types/search";

/**
 * search-discovery. Bare JSON responses (no envelope). Errors: ProblemDetails + numeric errorCode 509xx.
 * /search/listings and /search/suggest are anonymous; /search/saved validates the bearer JWT itself.
 * Contract: docs/contracts/buyer-search.md
 */
export const searchService = {
  listings: (query: SearchListingsQuery, signal?: AbortSignal) => {
    const { attributes, ...rest } = query;
    const flat: Record<string, string | number | boolean | string[] | undefined> = { ...rest };
    for (const [code, values] of Object.entries(attributes ?? {})) flat[`attributes[${code}]`] = values;
    return http.get<SearchListingsResponse>("/api/v1/search/listings", { query: flat, signal, auth: false });
  },

  /** prefix is 1..100 chars and limit 1..25 server-side (SearchSuggestionsRequestValidator.cs:12-46); longer input is clipped. */
  suggest: (query: SearchSuggestQuery, signal?: AbortSignal) =>
    http.get<SearchSuggestionsResponse>("/api/v1/search/suggest", { query: { prefix: query.prefix.slice(0, 100), limit: query.limit }, signal, auth: false }),

  savedSearches: (signal?: AbortSignal) => http.get<BuyerSavedSearchesListResponse>("/api/v1/search/saved", { signal }),
  createSavedSearch: (body: CreateSavedSearchRequest) => http.post<SavedSearch>("/api/v1/search/saved", body),
  deleteSavedSearch: (savedSearchId: string) => http.delete<void>(`/api/v1/search/saved/${encodeURIComponent(savedSearchId)}`),
};
