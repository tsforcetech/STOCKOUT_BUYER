import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/misc";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/feedback/states";
import { cn } from "@/lib/utils/cn";
import { PaginationBar } from "./pagination-bar";

export interface ServerPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Server-side pagination. When omitted the table paginates the (complete) list client-side. */
  pagination?: ServerPagination;
  /** Enables client-side sorting on columns with `enableSorting` (only for non-paginated endpoints). */
  clientSorting?: boolean;
  selectable?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (state: RowSelectionState) => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  toolbar?: React.ReactNode;
  pageSizeOptions?: number[];
  className?: string;
  /** Accessible table caption. */
  caption: string;
}

const DEFAULT_SIZES = [10, 20, 50, 100];

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  isFetching,
  error,
  onRetry,
  pagination,
  clientSorting = !pagination,
  selectable,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  emptyTitle = "No records found",
  emptyDescription,
  emptyAction,
  toolbar,
  pageSizeOptions = DEFAULT_SIZES,
  className,
  caption,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [clientPagination, setClientPagination] = React.useState({ pageIndex: 0, pageSize: pageSizeOptions[1] ?? 20 });

  const selectionColumn: ColumnDef<T, unknown> = React.useMemo(
    () => ({
      id: "__select",
      size: 40,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(v === true)} onClick={(e) => e.stopPropagation()} />
      ),
    }),
    [],
  );

  const table = useReactTable<T>({
    data: data ?? [],
    columns: selectable ? [selectionColumn, ...columns] : columns,
    getRowId,
    state: {
      sorting,
      rowSelection: rowSelection ?? {},
      ...(pagination ? {} : { pagination: clientPagination }),
    },
    enableRowSelection: Boolean(selectable),
    onRowSelectionChange: (updater) => {
      if (!onRowSelectionChange) return;
      onRowSelectionChange(typeof updater === "function" ? updater(rowSelection ?? {}) : updater);
    },
    onSortingChange: setSorting,
    onPaginationChange: setClientPagination,
    enableSorting: clientSorting,
    manualPagination: Boolean(pagination),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: clientSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: pagination ? undefined : getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const total = pagination ? pagination.totalCount : (data?.length ?? 0);
  const page = pagination ? pagination.page : clientPagination.pageIndex + 1;
  const pageSize = pagination ? pagination.pageSize : clientPagination.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const goTo = (next: number) => {
    if (pagination) pagination.onPageChange(next);
    else setClientPagination((p) => ({ ...p, pageIndex: next - 1 }));
  };
  const setSize = (size: number) => {
    if (pagination) pagination.onPageSizeChange(size);
    else setClientPagination({ pageIndex: 0, pageSize: size });
  };

  // Keep client page in range when the data shrinks (e.g. after a filter).
  React.useEffect(() => {
    if (!pagination && clientPagination.pageIndex > 0 && clientPagination.pageIndex >= pageCount) {
      setClientPagination((p) => ({ ...p, pageIndex: pageCount - 1 }));
    }
  }, [pagination, pageCount, clientPagination.pageIndex]);

  return (
    <div className={cn("@container overflow-hidden rounded-lg border border-border bg-surface", className)}>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">{toolbar}</div>}

      {error && !isLoading ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <TableSkeleton columns={Math.min(6, columns.length)} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className={cn("relative overflow-x-auto", isFetching && "opacity-70 transition-opacity")}>
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 z-10 bg-surface-muted">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        style={{ width: header.column.columnDef.size !== 150 ? header.column.columnDef.size : undefined }}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                        className="h-11 whitespace-nowrap border-b border-border px-4 text-left text-sm font-medium text-foreground"
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button type="button" className="-ml-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 hover:text-muted-foreground" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? <ArrowUpIcon className="size-3.5" /> : sorted === "desc" ? <ArrowDownIcon className="size-3.5" /> : <CaretUpDownIcon className="size-3.5 opacity-50" />}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn("transition-colors hover:bg-surface-muted/70 data-[state=selected]:bg-action-soft/60", onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row.original);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="h-[60px] whitespace-nowrap px-4 py-2.5 align-middle text-sm text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && !isLoading && total > 0 && (
        <PaginationBar
          className="border-t border-border px-4 py-3"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={goTo}
          onPageSizeChange={setSize}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}
