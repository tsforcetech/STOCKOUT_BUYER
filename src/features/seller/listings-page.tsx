import * as React from "react";
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
  Toolbar,
} from "@/components/common/section-card";
import { DataTable } from "@/components/tables/data-table";
import { SearchInput } from "@/components/tables/table-toolbar";
import { useUrlState } from "@/hooks/use-url-state";
import { sellerListingsService } from "@/services/seller-listings.service";
import {
  getSellerListingActions,
  LISTING_STATUSES,
  SELLER_LISTING_LIMITS,
  SELLER_LISTING_SORTS,
  type ListingStatus,
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
import { LISTING_STATUS_LABELS, SORT_LABELS } from "./lib/listing";
import { sellerKeys, useActiveSeller, useCategoryIndex } from "./lib/queries";
import {
  SellerListingCard,
  SellerListingCardSkeleton,
} from "./components/seller-listing-card";
import {
  ViewToggle,
  type SearchView,
} from "@/features/search/components/view-toggle";
import { ErrorState } from "@/components/feedback/states";

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

  const query: SellerListingListQuery = {
    page: state.page,
    pageSize: state.pageSize,
    status: (LISTING_STATUSES as readonly string[]).includes(state.status)
      ? (state.status as ListingStatus)
      : undefined,
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
  const categoryOptions = React.useMemo(
    () => [...categories.values()],
    [categories],
  );

  const columns = React.useMemo<
    ColumnDef<SellerListingListItemResponse, unknown>[]
  >(
    () => [
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
    [categories, openLifecycle, navigate],
  );

  const filtered = !!(state.status || state.categoryId || state.search);

  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Listings"
        description="Create, submit and manage your listings. Live listings can be paused or archived; edits are only possible on drafts."
        actions={
          enabled && (
            <>
              <Button asChild variant="secondary">
                <Link to="/seller/listings/bulk">
                  <UploadSimpleIcon /> Bulk upload
                </Link>
              </Button>
              <Button asChild variant="action">
                <Link to="/seller/listings/new">
                  <PlusIcon /> New listing
                </Link>
              </Button>
            </>
          )
        }
      />
      <ListingAccessNotice seller={seller} />
      <SectionCard className="mt-4">
        <Toolbar
          left={
            <SearchInput
              value={state.search}
              onChange={(search) => setState({ search }, { resetPage: true })}
              placeholder="Search by title…"
              label="Search listings"
            />
          }
          right={
            <>
              <NativeSelect
                className="h-[38px] w-44"
                aria-label="Status"
                value={state.status}
                onChange={(e) =>
                  setState({ status: e.target.value }, { resetPage: true })
                }
              >
                <option value="">All statuses</option>
                {LISTING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LISTING_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="h-[38px] w-52"
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
                    {"  ".repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="h-[38px] w-40"
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
              <RefreshButton
                onClick={() => void list.refetch()}
                spinning={list.isFetching}
              />
              <ViewToggle view={view} onChange={setView} />
            </>
          }
        />
        {view === "grid" ? (
          <ListingsGrid
            sellerId={sellerId}
            items={enabled ? list.data?.items : []}
            isLoading={enabled && list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
            categoryName={(id) => categories.get(id)?.name}
            onAction={openLifecycle}
            page={state.page}
            pageSize={state.pageSize}
            totalCount={list.data?.totalCount ?? 0}
            onPageChange={(page) => setState({ page })}
            empty={
              <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
                <p className="font-heading text-lg font-bold text-foreground">
                  {filtered
                    ? "No listings match your filters"
                    : "No listings yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filtered
                    ? "Try a different search, status or category."
                    : "Create a draft listing, or add many at once with Bulk upload."}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {filtered ? (
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
                        <Link to="/seller/listings/new">
                          <PlusIcon /> New listing
                        </Link>
                      </Button>
                    )
                  )}
                </div>
              </div>
            }
          />
        ) : (
          <DataTable
            caption="Your listings"
            columns={columns}
            data={enabled ? list.data?.items : []}
            getRowId={(l) => l.listingId}
            isLoading={enabled && list.isLoading}
            isFetching={list.isFetching}
            error={list.error}
            onRetry={() => void list.refetch()}
            onRowClick={(l) => navigate(`/seller/listings/${l.listingId}`)}
            pagination={{
              page: state.page,
              pageSize: state.pageSize,
              totalCount: list.data?.totalCount ?? 0,
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
                    <Link to="/seller/listings/new">
                      <PlusIcon /> New listing
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
