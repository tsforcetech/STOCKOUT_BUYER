import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowsDownUpIcon, BellSimpleIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { searchService } from "@/services/search.service";
import { useAuth } from "@/lib/auth/auth-context";
import { formatNumber } from "@/lib/utils/format";
import { ListingCard, ListingCardSkeleton } from "@/features/listings/components/listing-card";
import { ListingRow, ListingRowSkeleton } from "@/features/listings/components/listing-row";
import { DEFAULT_PAGE_SIZE, effectiveCurrency, MAX_QUERY_LENGTH, maxSearchPage, priceOrUndefined, readSearchState, SORT_OPTIONS, writeSearchState, type SearchState } from "./lib/search-params";
import { SearchFilters } from "./components/filters";
import { SaveSearchDialog } from "./components/save-search-dialog";
import { AppliedFilters, appliedFilterChips } from "./components/applied-filters";
import { FilterSheet } from "./components/filter-sheet";
import { SearchBox } from "./components/search-box";
import { useSearchView, ViewToggle } from "./components/view-toggle";
import { useFilterOptions } from "./lib/filter-options";

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";
const LIST = "flex flex-col gap-3";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const state = readSearchState(params);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [view, setView] = useSearchView();

  // Price filters/sorting require a currency (server error 50904 otherwise).
  const lastPage = maxSearchPage(DEFAULT_PAGE_SIZE);
  const page = Math.min(state.page, lastPage);
  const query = {
    q: state.q.slice(0, MAX_QUERY_LENGTH) || undefined,
    categoryId: state.categoryId || undefined,
    brandId: state.brandId.length ? state.brandId : undefined,
    conditionId: state.conditionId.length ? state.conditionId : undefined,
    gradeId: state.gradeId.length ? state.gradeId : undefined,
    stateOrEmirate: state.stateOrEmirate || undefined,
    city: state.city || undefined,
    attr: state.attr.length ? state.attr : undefined,
    minPrice: priceOrUndefined(state.minPrice),
    maxPrice: priceOrUndefined(state.maxPrice),
    currency: effectiveCurrency(state),
    inStockOnly: state.inStockOnly || undefined,
    sort: state.sort,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const search = useQuery({
    queryKey: ["search", "listings", query],
    queryFn: ({ signal }) => searchService.listings(query, signal),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Partial<SearchState>) => setParams(writeSearchState({ ...state, ...patch }));
  const clearFilters = () => setParams(writeSearchState({ q: state.q, sort: state.sort }));
  const clearAll = () => setParams(writeSearchState({ sort: state.sort }));
  const changeSort = (sort: string) => update({ sort: sort as SearchState["sort"], page: 1 });
  const openSave = () => (status === "authenticated" ? setSaveOpen(true) : navigate(`/login?next=${encodeURIComponent(`/search?${params.toString()}`)}`));

  const data = search.data;
  const options = useFilterOptions(state.categoryId);
  const categoryName = options.path[options.path.length - 1]?.name ?? data?.facets.categories.find((c) => c.categoryId === state.categoryId)?.categoryName;
  const heading = state.q ? `Results for “${state.q}”` : categoryName ?? "All surplus stock";
  const activeFilterCount = [state.categoryId, state.stateOrEmirate, state.city, state.minPrice || state.maxPrice, state.inStockOnly ? "1" : ""].filter(Boolean).length + state.brandId.length + state.conditionId.length + state.gradeId.length + state.attr.length;
  const chips = appliedFilterChips(state, data?.facets, {
    category: categoryName,
    attribute: (code) => options.requirements?.attributes.find((a) => a.code.toLowerCase() === code.toLowerCase())?.name,
  });
  const sortLabel = SORT_OPTIONS.find((o) => o.value === state.sort)?.label ?? "Sort";

  const filters = <SearchFilters state={state} facets={data?.facets} onChange={update} />;
  const sortOptions = SORT_OPTIONS.map((o) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  ));

  return (
    <div className="mx-auto max-w-[1336px] px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:pb-24">
      {options.path.length > 1 && (
        <nav aria-label="Category path" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {options.path.slice(0, -1).map((c) => (
            <button key={c.categoryId} type="button" onClick={() => update({ categoryId: c.categoryId, attr: [], brandId: [], page: 1 })} className="cursor-pointer hover:text-foreground hover:underline">
              {c.name} <span aria-hidden>/</span>
            </button>
          ))}
        </nav>
      )}
      <h1 className="font-heading text-2xl font-bold text-foreground sm:text-[34px] sm:leading-[42px]">{heading}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Verified surplus stock from UAE sellers. Filter by category, location, brand and specification.</p>

      {/* Mobile / tablet: sticky Filters + Sort bar under the site header (36px strip + 72px bar). */}
      <div className="sticky top-[108px] z-30 -mx-4 mt-3 border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        {/* Phones have no header search bar: give the results page its own field so shoppers can refine the query. */}
        <SearchBox variant="header" className="mb-2.5 [&>div]:h-10" />
        <div className="flex items-center gap-2">
        <Button variant="secondary" className="h-10 flex-1 rounded-full" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontalIcon /> Filters
          {activeFilterCount > 0 && <span className="rounded-full bg-action px-1.5 text-xs font-bold leading-5 text-action-foreground">{activeFilterCount}</span>}
        </Button>
        <div className="relative flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-secondary-border bg-surface px-3 text-sm font-medium text-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          <ArrowsDownUpIcon className="size-[18px] shrink-0" aria-hidden />
          <span className="truncate">{state.sort === "relevance" ? "Sort" : sortLabel}</span>
          <CaretDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <select aria-label="Sort results" value={state.sort} onChange={(e) => changeSort(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
            {sortOptions}
          </select>
        </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-8 lg:mt-8 lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden self-start lg:sticky lg:top-[168px] lg:block lg:max-h-[calc(100vh-184px)] lg:overflow-y-auto lg:pb-4 lg:pr-1" aria-label="Filters">
          {filters}
        </aside>

        <section aria-label="Results" className="min-h-[60vh] min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-border bg-surface px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="font-heading text-base font-bold text-foreground" aria-live="polite">
                {data ? `${formatNumber(data.pagination.totalCount)} listings` : "Searching…"}
              </p>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={openSave}>
                <BellSimpleIcon /> Save search
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <label className="hidden items-center gap-2 text-sm lg:flex">
                <span className="whitespace-nowrap text-muted-foreground">Sort by</span>
                <NativeSelect aria-label="Sort by" className="h-9 w-52 rounded-full text-sm" value={state.sort} onChange={(e) => changeSort(e.target.value)}>
                  {sortOptions}
                </NativeSelect>
              </label>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          <AppliedFilters chips={chips} onRemove={(chip) => update(chip.remove)} onClearAll={clearAll} />

          <div className={search.isFetching && !search.isLoading ? "opacity-70 transition-opacity" : undefined}>
            {search.error ? (
              <ErrorState error={search.error} onRetry={() => search.refetch()} />
            ) : search.isLoading ? (
              <div className={view === "list" ? LIST : GRID}>
                {Array.from({ length: 6 }).map((_, i) => (view === "list" ? <ListingRowSkeleton key={i} /> : <ListingCardSkeleton key={i} />))}
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 sm:py-20">
                <EmptyState
                  title="No listings match your search"
                  description="Try different words, remove some filters, or save this search to hear when matching stock is listed."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {activeFilterCount > 0 && (
                        <Button variant="secondary" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )}
                      <Button variant="action" onClick={openSave}>
                        <BellSimpleIcon /> Alert me when listed
                      </Button>
                    </div>
                  }
                />
                {options.tree.length > 0 && (
                  <div className="mx-auto mt-10 max-w-2xl text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Popular categories</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {(options.path.length ? (options.path[options.path.length - 1]!.children ?? []) : options.tree).slice(0, 8).map((c) => (
                        <button
                          key={c.categoryId}
                          type="button"
                          onClick={() => update({ categoryId: c.categoryId, attr: [], brandId: [], page: 1 })}
                          className="cursor-pointer rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-foreground transition-colors hover:border-foreground"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={view === "list" ? LIST : GRID}>
                  {data.items.map((item) => (view === "list" ? <ListingRow key={item.listingId} item={item} /> : <ListingCard key={item.listingId} item={item} />))}
                </div>
                <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
                  <Button variant="secondary" size="sm" disabled={!data.pagination.hasPreviousPage} onClick={() => update({ page: page - 1 })}>
                    <CaretLeftIcon /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {data.pagination.page} of {Math.max(1, Math.min(data.pagination.totalPages, lastPage))}
                  </span>
                  <Button variant="secondary" size="sm" disabled={!data.pagination.hasNextPage || page >= lastPage} onClick={() => update({ page: page + 1 })}>
                    Next <CaretRightIcon />
                  </Button>
                </nav>
              </>
            )}
          </div>
        </section>
      </div>

      <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} activeCount={activeFilterCount} resultCount={data?.pagination.totalCount} loading={search.isFetching} onClearAll={clearFilters}>
        {filters}
      </FilterSheet>

      <SaveSearchDialog open={saveOpen} onOpenChange={setSaveOpen} state={state} defaultName={heading.replace(/[“”]/g, "")} />
    </div>
  );
}
