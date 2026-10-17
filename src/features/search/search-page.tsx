import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookmarkSimpleIcon, CaretLeftIcon, CaretRightIcon, FunnelIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { searchService } from "@/services/search.service";
import { useAuth } from "@/lib/auth/auth-context";
import { formatNumber } from "@/lib/utils/format";
import { ListingCard, ListingCardSkeleton } from "@/features/listings/components/listing-card";
import { DEFAULT_PAGE_SIZE, readSearchState, SORT_OPTIONS, writeSearchState, type SearchState } from "./lib/search-params";
import { SearchFilters } from "./components/filters";
import { SaveSearchDialog } from "./components/save-search-dialog";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const state = readSearchState(params);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);

  // Price filters/sorting require a currency (server error 50904 otherwise).
  const needsCurrency = !!(state.minPrice || state.maxPrice || state.sort.startsWith("price"));
  const query = {
    q: state.q || undefined,
    categoryId: state.categoryId || undefined,
    brandId: state.brandId.length ? state.brandId : undefined,
    conditionId: state.conditionId.length ? state.conditionId : undefined,
    gradeId: state.gradeId.length ? state.gradeId : undefined,
    stateOrEmirate: state.stateOrEmirate || undefined,
    minPrice: state.minPrice ? Number(state.minPrice) : undefined,
    maxPrice: state.maxPrice ? Number(state.maxPrice) : undefined,
    currency: needsCurrency ? state.currency || "AED" : state.currency || undefined,
    inStockOnly: state.inStockOnly || undefined,
    sort: state.sort,
    page: state.page,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const search = useQuery({
    queryKey: ["search", "listings", query],
    queryFn: ({ signal }) => searchService.listings(query, signal),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Partial<SearchState>) => {
    setParams(writeSearchState({ ...state, ...patch }));
    setFiltersOpen(false);
  };

  const data = search.data;
  const categoryName = data?.facets.categories.find((c) => c.categoryId === state.categoryId)?.categoryName;
  const heading = state.q ? `Results for “${state.q}”` : categoryName ?? "All surplus stock";
  const activeFilterCount = [state.categoryId, state.stateOrEmirate, state.minPrice || state.maxPrice, state.inStockOnly ? "1" : ""].filter(Boolean).length + state.brandId.length + state.conditionId.length + state.gradeId.length;

  const filters = <SearchFilters state={state} facets={data?.facets} onChange={update} />;

  return (
    <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-[32px] sm:leading-10">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {data ? `${formatNumber(data.pagination.totalCount)} listings` : "Searching…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <FunnelIcon /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (status === "authenticated" ? setSaveOpen(true) : navigate(`/login?next=${encodeURIComponent(`/search?${params.toString()}`)}`))}
          >
            <BookmarkSimpleIcon /> Save search
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <NativeSelect className="h-8 w-48 text-sm" value={state.sort} onChange={(e) => update({ sort: e.target.value as SearchState["sort"], page: 1 })}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          {activeFilterCount > 0 && (
            <button type="button" onClick={() => setParams(writeSearchState({ q: state.q, sort: state.sort }))} className="mb-4 inline-flex cursor-pointer items-center gap-1 text-sm text-foreground underline">
              <XIcon className="size-3.5" /> Clear all filters
            </button>
          )}
          {filters}
        </aside>

        <section aria-label="Results" className={search.isFetching && !search.isLoading ? "opacity-70 transition-opacity" : undefined}>
          {search.error ? (
            <ErrorState error={search.error} onRetry={() => search.refetch()} />
          ) : search.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="No listings match your search"
              description="Try different words, remove some filters, or save this search to hear when matching stock is listed."
              action={
                activeFilterCount > 0 ? (
                  <Button variant="secondary" onClick={() => setParams(writeSearchState({ q: state.q }))}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((item) => (
                  <ListingCard key={item.listingId} item={item} />
                ))}
              </div>
              <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
                <Button variant="secondary" size="sm" disabled={!data.pagination.hasPreviousPage} onClick={() => update({ page: state.page - 1 })}>
                  <CaretLeftIcon /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)}
                </span>
                <Button variant="secondary" size="sm" disabled={!data.pagination.hasNextPage} onClick={() => update({ page: state.page + 1 })}>
                  Next <CaretRightIcon />
                </Button>
              </nav>
            </>
          )}
        </section>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent title="Filters" side="right" className="overflow-y-auto bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-heading text-xl font-bold">Filters</p>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="cursor-pointer">
              <XIcon className="size-6" />
            </button>
          </div>
          {filters}
        </SheetContent>
      </Dialog>

      <SaveSearchDialog open={saveOpen} onOpenChange={setSaveOpen} state={state} defaultName={heading.replace(/[“”]/g, "")} />
    </div>
  );
}
