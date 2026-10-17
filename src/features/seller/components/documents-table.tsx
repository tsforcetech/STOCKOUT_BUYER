import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { FileTextIcon, TrashIcon } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EntityCell } from "@/components/common/entity-cell";
import { RowAction } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { isApiError } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { marketplaceService } from "@/services/marketplace.service";
import type { SellerDocumentResponse } from "@/api/types/user-organization";
import { sellerAccountErrorMessage } from "../lib/errors";
import { sellerKeys } from "../lib/queries";
import { FileDownloadAction } from "./file-link";
import { toast } from "sonner";

export function useSellerDocuments(sellerId: string) {
  return useQuery({ queryKey: sellerKeys.documents(sellerId), queryFn: ({ signal }) => marketplaceService.documents(sellerId, signal) });
}

export function DocumentsTable({ sellerId, canDelete, emptyAction }: { sellerId: string; canDelete: boolean; emptyAction?: React.ReactNode }) {
  const qc = useQueryClient();
  const docs = useSellerDocuments(sellerId);
  const [toDelete, setToDelete] = React.useState<SellerDocumentResponse | null>(null);

  const remove = useApiMutation({
    toastOnError: false,
    mutationFn: async (doc: SellerDocumentResponse) => {
      try {
        await marketplaceService.deleteDocument(sellerId, doc.sellerDocumentId);
      } catch (error) {
        // Backend defect: DELETE answers 404 even when the row was deleted. Verify by re-reading the list.
        if (!(isApiError(error) && error.status === 404)) throw error;
      }
      const fresh = await qc.fetchQuery({ queryKey: sellerKeys.documents(sellerId), queryFn: ({ signal }) => marketplaceService.documents(sellerId, signal), staleTime: 0 });
      if (fresh.some((d) => d.sellerDocumentId === doc.sellerDocumentId)) throw new Error("The document could not be deleted. Please try again.");
    },
    successMessage: "Document deleted.",
    onSuccess: () => setToDelete(null),
  });

  const columns = React.useMemo<ColumnDef<SellerDocumentResponse, unknown>[]>(
    () => [
      { id: "type", header: "Document", accessorFn: (d) => d.documentType, cell: ({ row }) => <EntityCell icon={<FileTextIcon />} title={row.original.documentType} subtitle={row.original.documentNumber ?? "No number"} /> },
      { id: "issued", header: "Issued", accessorFn: (d) => d.issuedAt ?? "", cell: ({ row }) => formatDate(row.original.issuedAt) },
      { id: "expires", header: "Expires", accessorFn: (d) => d.expiresAt ?? "", cell: ({ row }) => formatDate(row.original.expiresAt) },
      { id: "status", header: "Status", accessorFn: (d) => d.verificationStatus, cell: ({ row }) => <StatusBadge value={row.original.verificationStatus} /> },
      { id: "uploaded", header: "Added", accessorFn: (d) => d.createdAtUtc, cell: ({ row }) => formatDateTime(row.original.createdAtUtc) },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1.5">
            <FileDownloadAction fileId={row.original.fileAssetId} label="Open document" />
            {canDelete && (
              <RowAction label="Delete document" tone="danger" onClick={() => setToDelete(row.original)}>
                <TrashIcon />
              </RowAction>
            )}
          </div>
        ),
      },
    ],
    [canDelete],
  );

  return (
    <>
      <DataTable
        caption="Verification documents"
        columns={columns}
        data={docs.data}
        getRowId={(d) => d.sellerDocumentId}
        isLoading={docs.isLoading}
        isFetching={docs.isFetching}
        error={docs.error}
        onRetry={() => void docs.refetch()}
        emptyTitle="No documents yet"
        emptyDescription="Upload your trade licence, Emirates ID or VAT certificate so we can verify your account."
        emptyAction={emptyAction}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete document?"
        description={`“${toDelete?.documentType ?? ""}” will be removed from your verification documents.`}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete, { onError: (e) => toast.error(sellerAccountErrorMessage(e)) })}
      />
    </>
  );
}
