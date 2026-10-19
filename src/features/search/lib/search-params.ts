/** UAE emirates as stored in listing locations (search filter `stateOrEmirate`). */
export const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"] as const;

export const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "date_desc", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** Search state as it lives in the URL (/search?q=…&categoryId=…). Shareable and back-button safe. */
export interface SearchState {
  q: string;
  categoryId: string;
  brandId: string[];
  conditionId: string[];
  gradeId: string[];
  stateOrEmirate: string;
  city: string;
  /** Attribute filters as `code:value` (OR within a code, AND across codes). */
  attr: string[];
  minPrice: string;
  maxPrice: string;
  currency: string;
  inStockOnly: boolean;
  sort: SortValue;
  page: number;
}

export const DEFAULT_PAGE_SIZE = 24;

/**
 * search-discovery rejects page*pageSize > 1000 with 400 MARKETPLACE_SEARCH_PAGINATION_LIMIT_EXCEEDED
 * (SearchListingsRequestValidator.cs:38), but its `hasNextPage` only checks page*pageSize < 1000
 * (SearchListingsService.cs:272), so with 24 per page it offers a page 42 that fails. Cap it here.
 */
export const MAX_SEARCH_RESULT_WINDOW = 1000;
export const maxSearchPage = (pageSize: number) => Math.max(1, Math.floor(MAX_SEARCH_RESULT_WINDOW / pageSize));

/** `q` is limited to 200 chars server-side (SearchListingsRequestValidator.cs:97). */
export const MAX_QUERY_LENGTH = 200;

/** Parses a price filter; anything that isn't a finite, non-negative number is dropped (server answers 400 otherwise). */
export function priceOrUndefined(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * A currency is required whenever a price filter or price sort is active (50904 MARKETPLACE_SEARCH_CURRENCY_REQUIRED,
 * SearchListingsRequestValidator.cs:71-76). Used by both the search request and the saved-search body.
 */
export function effectiveCurrency(state: Pick<SearchState, "minPrice" | "maxPrice" | "sort" | "currency">): string | undefined {
  const needsCurrency = priceOrUndefined(state.minPrice) !== undefined || priceOrUndefined(state.maxPrice) !== undefined || state.sort.startsWith("price");
  return needsCurrency ? state.currency || "AED" : state.currency || undefined;
}

export function readSearchState(params: URLSearchParams): SearchState {
  const sort = params.get("sort");
  const page = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    categoryId: params.get("categoryId") ?? "",
    brandId: params.getAll("brandId"),
    conditionId: params.getAll("conditionId"),
    gradeId: params.getAll("gradeId"),
    stateOrEmirate: params.get("stateOrEmirate") ?? "",
    city: params.get("city") ?? "",
    attr: params.getAll("attr").filter((a) => a.indexOf(":") > 0),
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    currency: params.get("currency") ?? "",
    inStockOnly: params.get("inStockOnly") === "true",
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as SortValue) : "relevance",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function writeSearchState(state: Partial<SearchState>): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => v && p.set(k, v);
  set("q", state.q?.trim());
  set("categoryId", state.categoryId);
  state.brandId?.forEach((v) => p.append("brandId", v));
  state.conditionId?.forEach((v) => p.append("conditionId", v));
  state.gradeId?.forEach((v) => p.append("gradeId", v));
  set("stateOrEmirate", state.stateOrEmirate);
  set("city", state.city);
  state.attr?.forEach((v) => p.append("attr", v));
  set("minPrice", state.minPrice);
  set("maxPrice", state.maxPrice);
  set("currency", state.currency);
  if (state.inStockOnly) p.set("inStockOnly", "true");
  if (state.sort && state.sort !== "relevance") p.set("sort", state.sort);
  if (state.page && state.page > 1) p.set("page", String(state.page));
  return p;
}

export function searchHref(state: Partial<SearchState>): string {
  const qs = writeSearchState(state).toString();
  return qs ? `/search?${qs}` : "/search";
}

/** `code:value` → [code, value]; codes are matched case-insensitively. */
export function splitAttr(entry: string): [string, string] {
  const i = entry.indexOf(":");
  return [entry.slice(0, i), entry.slice(i + 1)];
}
export const attrKey = (code: string, value: string) => `${code.toLowerCase()}:${value}`;
