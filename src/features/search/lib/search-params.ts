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
  minPrice: string;
  maxPrice: string;
  currency: string;
  inStockOnly: boolean;
  sort: SortValue;
  page: number;
}

export const DEFAULT_PAGE_SIZE = 24;

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
