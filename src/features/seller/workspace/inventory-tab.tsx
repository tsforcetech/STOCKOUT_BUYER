import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { LockIcon, PackageIcon, ShoppingCartIcon } from "@phosphor-icons/react";
import { SectionCard } from "@/components/common/section-card";
import { StatCards } from "@/components/common/stat-cards";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { DataTable } from "@/components/tables/data-table";
import { formatDateTime, formatNumber, humanize } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import { getSellerListingActions, type ListingDetailResponse, type ListingInventoryMovementItemDto } from "@/api/types/seller-listings";
import { Notice } from "../components/notice";
import { sellerKeys, useListingRequirements } from "../lib/queries";
import { AdjustStockForm, SetStockForm } from "./inventory-forms";

function signed(n: number) {
  return n > 0 ? `+${formatNumber(n)}` : formatNumber(n);
}

export function InventoryTab({ sellerId, listing }: { sellerId: string; listing: ListingDetailResponse }) {
  const id = listing.listingId;
  const can = getSellerListingActions(listing);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const inv = useQuery({ queryKey: sellerKeys.inventory(sellerId, id), queryFn: ({ signal }) => sellerListingsService.inventory(sellerId, id, signal) });
  const moves = useQuery({
    queryKey: sellerKeys.movements(sellerId, id, page, pageSize),
    queryFn: ({ signal }) => sellerListingsService.movements(sellerId, id, { page, pageSize }, signal),
    placeholderData: keepPreviousData,
  });
  const version = listing.currentDraftVersion ?? listing.publishedVersion;
  const req = useListingRequirements(version?.categoryId);
  const unit = req.data?.unitRules.units.find((u) => u.unitId === inv.data?.quantityUnitId);
  const unitLabel = unit ? ` ${unit.symbol || unit.name}` : "";

  const columns = React.useMemo<ColumnDef<ListingInventoryMovementItemDto, unknown>[]>(
    () => [
      { id: "when", header: "When", cell: ({ row }) => formatDateTime(row.original.createdAtUtc) },
      { id: "type", header: "Movement", cell: ({ row }) => humanize(row.original.movementType) },
      { id: "onhand", header: "On hand", cell: ({ row }) => `${signed(row.original.onHandQuantityDelta)} → ${formatNumber(row.original.onHandQuantityAfter)}` },
      { id: "reserved", header: "Reserved", cell: ({ row }) => `${signed(row.original.reservedQuantityDelta)} → ${formatNumber(row.original.reservedQuantityAfter)}` },
      { id: "reason", header: "Reason", cell: ({ row }) => row.original.reasonCode ?? "—" },
      { id: "notes", header: "Notes", cell: ({ row }) => <span className="block max-w-[240px] truncate" title={row.original.notes ?? undefined}>{row.original.notes ?? "—"}</span> },
    ],
    [],
  );

  if (inv.isLoading) return <PageSkeleton />;
  if (inv.error || !inv.data) return <ErrorState error={inv.error} onRetry={() => void inv.refetch()} title="Couldn't load stock" />;
  const data = inv.data;
  const readOnly = !can.canEditInventory;

  return (
    <div className="space-y-4">
      {readOnly && <Notice>Archived listings' stock can't be changed.</Notice>}
      {data.sellableQuantity <= 0 && !readOnly && <Notice tone="warning">Sellable stock is 0. A listing needs stock above 0 to go live or be resumed.</Notice>}
      <StatCards
        className="xl:grid-cols-3"
        items={[
          { label: "On hand", value: `${formatNumber(data.onHandQuantity)}${unitLabel}`, hint: data.rowVersion === null ? "No stock recorded yet" : "Physical stock you hold", icon: <PackageIcon /> },
          { label: "Reserved", value: `${formatNumber(data.reservedQuantity)}${unitLabel}`, hint: "Held for buyers' checkouts", icon: <LockIcon /> },
          { label: "Sellable", value: `${formatNumber(data.sellableQuantity)}${unitLabel}`, hint: "On hand minus reserved", icon: <ShoppingCartIcon /> },
        ]}
      />
      {!readOnly && (
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard>
            <SetStockForm sellerId={sellerId} listingId={id} inventory={data} disabled={readOnly} />
          </SectionCard>
          <SectionCard>
            <AdjustStockForm sellerId={sellerId} listingId={id} inventory={data} disabled={readOnly} />
          </SectionCard>
        </div>
      )}
      <SectionCard>
        <h3 className="mb-3 font-heading text-base font-bold text-foreground">Stock movements</h3>
        <DataTable
          caption="Stock movements"
          columns={columns}
          data={moves.data?.items}
          getRowId={(m) => m.movementId}
          isLoading={moves.isLoading}
          isFetching={moves.isFetching}
          error={moves.error}
          onRetry={() => void moves.refetch()}
          pagination={{ page, pageSize, totalCount: moves.data?.totalCount ?? 0, onPageChange: setPage, onPageSizeChange: (s) => {
              setPageSize(s);
              setPage(1);
            },
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          emptyTitle="No stock movements yet"
          emptyDescription="Movements appear when you set or adjust stock and when buyers reserve items."
        />
      </SectionCard>
    </div>
  );
}
