import type { ColumnDef } from "@tanstack/react-table";
import { PackageIcon } from "@phosphor-icons/react";
import { EntityCell } from "@/components/common/entity-cell";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDateTime } from "@/lib/utils/format";
import type { SellerListingListItemResponse } from "@/api/types/seller-listings";
import { listingState } from "../lib/listing";
import type { CategoryEntry } from "../lib/queries";

/** Columns shared by the dashboard and listings table. The list API has no price/image/stock (contract L2). */
export function baseListingColumns(categories: Map<string, CategoryEntry>): ColumnDef<SellerListingListItemResponse, unknown>[] {
  return [
    {
      id: "title",
      header: "Listing",
      accessorFn: (l) => l.title,
      cell: ({ row }) => (
        <EntityCell
          icon={<PackageIcon />}
          title={row.original.title || "Untitled listing"}
          subtitle={categories.get(row.original.categoryId)?.path.join(" › ") ?? `LST-${row.original.listingId.slice(0, 8).toUpperCase()}`}
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (l) => l.status,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge {...listingState(row.original)} />
          {row.original.status !== "DRAFT" && row.original.currentDraftVersionId && (!row.original.currentDraftVersionStatus || row.original.currentDraftVersionStatus === "DRAFT") && <span className="text-xs text-muted-foreground">+ draft</span>}
        </div>
      ),
    },
    { id: "created", header: "Created", accessorFn: (l) => l.createdAtUtc, cell: ({ row }) => formatDateTime(row.original.createdAtUtc) },
    { id: "updated", header: "Updated", accessorFn: (l) => l.updatedAtUtc ?? "", cell: ({ row }) => formatDateTime(row.original.updatedAtUtc) },
  ];
}
