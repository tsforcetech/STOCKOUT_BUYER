import * as React from "react";
import { PendingCorrectionsNotice } from "./lib/corrections";
import { Link, useNavigate } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArchiveIcon,
  PaperPlaneTiltIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import {
  RefreshButton,
  RowAction,
  SectionCard,
} from "@/components/common/section-card";
import { DataTable } from "@/components/tables/data-table";
import { SearchInput } from "@/components/tables/table-toolbar";
import { useUrlState } from "@/hooks/use-url-state";
import { sellerListingsService } from "@/services/seller-listings.service";
import {
  getSellerListingActions,
  SELLER_LISTING_LIMITS,
  SELLER_LISTING_SORTS,
  type SellerListingListItemResponse,
  type SellerListingListQuery,
  type SellerListingSort,
} from "@/api/types/seller-listings";
import { baseListingColumns } from "./components/listing-columns";
import {
  ListingAccessNotice,
  canManageListings,
} from "./components/listing-access-notice";
import { useListingLifecycle } from "./components/listing-lifecycle";
import { BulkBar } from "./components/bulk-bar";
import { LISTING_VIEWS, SORT_LABELS } from "./lib/listing";
import { FilterPills } from "@/components/common/filter-pills";

/** Listings fetched at once for the status pills; far above any one seller today. */
const ALL_LISTINGS_CAP = 1000;
import { sellerKeys, useActiveSeller, useCategoryIndex } from "./lib/queries";
import {
  SellerListingCard,
  SellerListingCardSkeleton,
} from "./components/seller-listing-card";
import {
  ViewToggle,
  type SearchView,
} from "@/features/search/components/view-toggle";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { formatNumber } from "@/lib/utils/format";

const VIEW_KEY = "stockout.market.sellerListingsView";
function useListingsView(): [SearchView, (v: SearchView) => void] {
  const [view, setView] = React.useState<SearchView>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  return [
    view,
    (v) => {
      setView(v);
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {
        /* storage unavailable */
      }
    },
  ];
}

const DEFAULTS = {
  page: 1,
  pageSize: 20,
  status: "",
  categoryId: "",
  search: "",
  sort: "CreatedAtUtcDesc",
};

export default function SellerListingsPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const enabled = canManageListings(seller);
  const navigate = useNavigate();
  const [state, setState] = useUrlState(DEFAULTS);
  const { index: categories, data: tree } = useCategoryIndex();
  const { open: openLifecycle, dialogs: lifecycleDialogs } =
    useListingLifecycle(sellerId);

  // All of the seller's listings in one request (the API has no page-size cap): the status pills need version
  // states the API can't filter by, so counting, filtering and paging happen here.
  const query: SellerListingListQuery = {
    page: 1,
    pageSize: ALL_LISTINGS_CAP,
    categoryId: state.categoryId || undefined,
    search:
      state.search.slice(0, SELLER_LISTING_LIMITS.SEARCH_MAX_LENGTH) ||
      undefined,
    sort: (SELLER_LISTING_SORTS as readonly string[]).includes(state.sort)
      ? (state.sort as SellerListingSort)
      : undefined,
  };
  const list = useQuery({
    queryKey: sellerKeys.listingList(sellerId, query),
    queryFn: ({ signal }) =>
      sellerListingsService.list(sellerId, query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

  const [view, setView] = useListingsView();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const toggleSelect = React.useCallback(
    (id: string) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const statusView =
    LISTING_VIEWS.find((v) => v.key === state.status) ?? LISTING_VIEWS[0]!;
  const all = React.useMemo(() => list.data?.items ?? [], [list.data]);
  const visible = React.useMemo(
    () => all.filter(statusView.match),
    [all, statusView],
  );
  const data = list.data
    ? {
        items: visible.slice(
          (state.page - 1) * state.pageSize,
          state.page * state.pageSize,
        ),
        totalCount: visible.length,
      }
    : undefined;
  // Only listings still in the loaded list count as selected (an archive or a refresh may drop some).
  const selected = React.useMemo(
    () => all.filter((l) => selectedIds.has(l.listingId)),
    [all, selectedIds],
  );
  const pageIds = data?.items.map((l) => l.listingId) ?? [];
  const allOnPage =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const togglePage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (allOnPage) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  const categoryOptions = React.useMemo(
    () => [...categories.values()],
    [categories],
  );

  const columns = React.useMemo<
    ColumnDef<SellerListingListItemResponse, unknown>[]
  >(
    () => [
      {
        id: "select",
        header: () => <span className="sr-only">Select</span>,
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-foreground"
            checked={selectedIds.has(row.original.listingId)}
            onChange={() => toggleSelect(row.original.listingId)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.original.title}`}
          />
        ),
      },
      ...baseListingColumns(categories),
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const l = row.original;
          // The list has no expiry; the backend re-checks expiry on every action.
          const can = getSellerListingActions({
            status: l.status,
            currentDraftVersionId: l.currentDraftVersionId,
            expiresAtUtc: null,
          });
          const target = { listingId: l.listingId, title: l.title };
          return (
            <div className="flex justify-end gap-1.5">
              <RowAction
                label={can.canUpdateDraft ? "Edit" : "Open"}
                onClick={() => navigate(`/seller/listings/${l.listingId}`)}
              >
                <PencilSimpleIcon />
              </RowAction>
              {can.canSubmit && (
                <RowAction
                  label="Submit for review"
                  tone="success"
                  onClick={() => openLifecycle("submit", target)}
                >
                  <PaperPlaneTiltIcon />
                </RowAction>
              )}
              {can.canPause && (
                <RowAction
                  label="Pause"
                  onClick={() => openLifecycle("pause", target)}
                >
                  <PauseIcon />
                </RowAction>
              )}
              {can.canResume && (
                <RowAction
                  label="Resume"
                  tone="success"
                  onClick={() => openLifecycle("resume", target)}
                >
                  <PlayIcon />
                </RowAction>
              )}
              {can.canArchive && l.status !== "ARCHIVED" && (
                <RowAction
                  label="Archive"
                  tone="danger"
                  onClick={() => openLifecycle("archive", target)}
                >
                  <ArchiveIcon />
                </RowAction>
              )}
            </div>
          );
        },
      },
    ],
    [categories, openLifecycle, navigate, selectedIds, toggleSelect],
  );

  const filtered = !!(
    (state.status && state.status !== "all") ||
    state.categoryId ||
    state.search
  );

  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Listings"
        description="Click a price or stock figure to change it. Tick listings to pause, resume, send for review, reprice or archive several at once."
        actions={
          enabled && (
            <>
              <Button asChild variant="secondary">
                <Link to="/seller/listings/import">
                  <UploadSimpleIcon /> Bulk import
                </Link>
              </Button>
              <Button asChild variant="action">
                <Link to="/seller/listings/quick">
                  <PlusIcon /> Add listing
                </Link>
              </Button>
            </>
          )
        }
      />
      <ListingAccessNotice seller={seller} />
      {enabled && <PendingCorrectionsNotice sellerId={sellerId} />}
      <SectionCard className="mt-4">
        {enabled && (
          <FilterPills
            className="mb-4"
            label="Listing status"
            value={statusView.key}
            onChange={(v) =>
              setState({ status: v === "all" ? "" : v }, { resetPage: true })
            }
            items={LISTING_VIEWS.map((v) => ({
              value: v.key,
              label: v.label,
              count: list.data ? all.filter(v.match).length : undefined,
              highlight: v.needsAction,
            }))}
          />
        )}
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 xl:w-[320px]">
            <SearchInput
              value={state.search}
              onChange={(search) => setState({ search }, { resetPage: true })}
              placeholder="Search by title…"
              label="Search listings"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <NativeSelect
              className="h-[38px] w-full sm:w-52"
              aria-label="Category"
              value={state.categoryId}
              onChange={(e) =>
                setState({ categoryId: e.target.value }, { resetPage: true })
              }
              disabled={!tree}
            >
              <option value="">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.depth > 0
                    ? `${c.path.slice(0, -1).join(" › ")} › ${c.name}`
                    : c.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="h-[38px] w-full sm:w-40"
              aria-label="Sort"
              value={state.sort}
              onChange={(e) =>
                setState({ sort: e.target.value }, { resetPage: true })
              }
            >
              {SELLER_LISTING_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
            <div className="flex items-center justify-end gap-2">
              <RefreshButton
                onClick={() => void list.refetch()}
                spinning={list.isFetching}
              />
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>
        </div>
        {enabled && data && (filtered || data.totalCount > 0) && (
          <div className="-mt-1 mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {data.items.length > 0 && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-foreground">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-foreground"
                  checked={allOnPage}
                  onChange={togglePage}
                />
                Select page
              </label>
            )}
            <span aria-live="polite">
              {formatNumber(data.totalCount)}{" "}
              {data.totalCount === 1 ? "listing" : "listings"}
              {filtered ? " match your filters" : ""}
            </span>
            {filtered && (
              <button
                type="button"
                className="cursor-pointer text-foreground underline underline-offset-4 hover:text-muted-foreground"
                onClick={() =>
                  setState(
                    { status: "", categoryId: "", search: "" },
                    { resetPage: true },
                  )
                }
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        {enabled && selected.length > 0 && (
          <BulkBar
            sellerId={sellerId}
            selected={selected}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
        {view === "grid" ? (
          <ListingsGrid
            sellerId={sellerId}
            items={enabled ? data?.items : []}
            isLoading={enabled && list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
            categoryName={(id) => categories.get(id)?.name}
            onAction={openLifecycle}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            page={state.page}
            pageSize={state.pageSize}
            totalCount={data?.totalCount ?? 0}
            onPageChange={(page) => setState({ page })}
            empty={
              <EmptyState
                className="rounded-xl border border-dashed border-border-strong"
                title={
                  filtered
                    ? "No listings match your filters"
                    : "No listings yet"
                }
                description={
                  filtered
                    ? "Try a different search, status or category."
                    : "Add one item in minutes, or your whole stock list in one go."
                }
                action={
                  filtered ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setState(
                          { status: "", categoryId: "", search: "" },
                          { resetPage: true },
                        )
                      }
                    >
                      Clear filters
                    </Button>
                  ) : (
                    enabled && (
                      <>
                        <Button asChild variant="secondary">
                          <Link to="/seller/listings/import">
                            <UploadSimpleIcon /> Bulk import
                          </Link>
                        </Button>
                        <Button asChild variant="action">
                          <Link to="/seller/listings/quick">
                            <PlusIcon /> Add listing
                          </Link>
                        </Button>
                      </>
                    )
                  )
                }
              />
            }
          />
        ) : (
          <DataTable
            caption="Your listings"
            columns={columns}
            data={enabled ? data?.items : []}
            getRowId={(l) => l.listingId}
            isLoading={enabled && list.isLoading}
            isFetching={list.isFetching}
            error={list.error}
            onRetry={() => void list.refetch()}
            onRowClick={(l) => navigate(`/seller/listings/${l.listingId}`)}
            pagination={{
              page: state.page,
              pageSize: state.pageSize,
              totalCount: data?.totalCount ?? 0,
              onPageChange: (page) => setState({ page }),
              onPageSizeChange: (pageSize) =>
                setState({ pageSize }, { resetPage: true }),
            }}
            emptyTitle={
              filtered ? "No listings match your filters" : "No listings yet"
            }
            emptyDescription={
              filtered
                ? "Try a different search, status or category."
                : "Create a draft listing. You can add photos, attributes and stock before submitting it for review."
            }
            emptyAction={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setState(
                      { status: "", categoryId: "", search: "" },
                      { resetPage: true },
                    )
                  }
                >
                  Clear filters
                </Button>
              ) : (
                enabled && (
                  <Button asChild variant="action">
                    <Link to="/seller/listings/quick">
                      <PlusIcon /> Add listing
                    </Link>
                  </Button>
                )
              )
            }
          />
        )}
      </SectionCard>
      {lifecycleDialogs}
    </>
  );
}

function ListingsGrid({
  sellerId,
  items,
  isLoading,
  error,
  onRetry,
  categoryName,
  onAction,
  selectedIds,
  onToggleSelect,
  page,
  pageSize,
  totalCount,
  onPageChange,
  empty,
}: {
  sellerId: string;
  items: SellerListingListItemResponse[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  categoryName: (categoryId: string) => string | undefined;
  onAction: React.ComponentProps<typeof SellerListingCard>["onAction"];
  selectedIds: Set<string>;
  onToggleSelect: (listingId: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  empty: React.ReactNode;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  const list = items ?? [];
  if (!isLoading && list.length === 0)
    return <div className="mt-4">{empty}</div>;
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div className="mt-4">
      <ul
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        aria-label="Your listings"
      >
        {isLoading
          ? Array.from({ length: 8 }, (_, i) => (
              <li key={i}>
                <SellerListingCardSkeleton />
              </li>
            ))
          : list.map((l) => (
              <li key={l.listingId}>
                <SellerListingCard
                  sellerId={sellerId}
                  item={l}
                  categoryName={categoryName(l.categoryId)}
                  onAction={onAction}
                  selected={selectedIds.has(l.listingId)}
                  onToggleSelect={onToggleSelect}
                />
              </li>
            ))}
      </ul>
      {totalCount > pageSize && (
        <nav
          className="mt-6 flex items-center justify-center gap-3"
          aria-label="Pagination"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages} · {totalCount} listings
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
