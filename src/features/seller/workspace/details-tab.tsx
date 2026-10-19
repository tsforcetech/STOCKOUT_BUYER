import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { sellerListingsService } from "@/services/seller-listings.service";
import { getSellerListingActions, type CreateListingDraftRequest, type ListingDetailResponse } from "@/api/types/seller-listings";
import { CategoryPicker } from "../components/category-picker";
import { ListingDetailsForm } from "../components/listing-details-form";
import { Notice } from "../components/notice";
import { isVersionConflict } from "../lib/errors";
import { listingFormFromVersion } from "../lib/listing-form";
import { patchListingRowVersion, sellerKeys, useCategoryIndex } from "../lib/queries";

export function DetailsTab({ sellerId, listing }: { sellerId: string; listing: ListingDetailResponse }) {
  const qc = useQueryClient();
  const version = listing.currentDraftVersion ?? listing.publishedVersion;
  const can = getSellerListingActions(listing);
  const { index } = useCategoryIndex();
  const [categoryId, setCategoryId] = React.useState(version?.categoryId ?? "");
  const [picking, setPicking] = React.useState(false);
  const [picked, setPicked] = React.useState(categoryId);

  const save = useApiMutation({
    toastOnError: false,
    mutationFn: async (payload: Required<CreateListingDraftRequest>) => {
      const current = qc.getQueryData<ListingDetailResponse>(sellerKeys.detail(sellerId, listing.listingId)) ?? listing;
      try {
        return await sellerListingsService.update(sellerId, listing.listingId, { ...payload, expectedRowVersion: current.rowVersion });
      } catch (error) {
        if (isVersionConflict(error)) await qc.invalidateQueries({ queryKey: sellerKeys.detail(sellerId, listing.listingId) });
        throw error;
      }
    },
    successMessage: "Draft saved.",
    onSuccess: (res, payload) => {
      patchListingRowVersion(qc, sellerId, listing.listingId, res.rowVersion);
      void qc.invalidateQueries({ queryKey: sellerKeys.detail(sellerId, listing.listingId) });
      void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId), predicate: (q) => q.queryKey[3] === "list" });
      // Changing the category deletes all attribute values on the draft (contract L4).
      if (payload.categoryId !== version?.categoryId) void qc.invalidateQueries({ queryKey: sellerKeys.attributes(sellerId, listing.listingId) });
    },
  });

  if (!version) return <Notice tone="warning">This listing has no version to show.</Notice>;
  const category = index.get(categoryId);
  const categoryChanged = categoryId !== version.categoryId;

  return (
    <div className="space-y-4 pt-1">
      {!can.canUpdateDraft ? (
        <Notice>
          {listing.status === "PUBLISHED" || listing.status === "SUSPENDED"
            ? "You're viewing the published version. Published listings can't be edited through the seller portal yet."
            : "This listing is read-only in its current state."}
        </Notice>
      ) : (
        <Notice>
          <strong className="font-medium">Already submitted this draft?</strong> Wait for the review before editing — the marketplace can't yet show whether a draft is
          under review, and changes made during review may go live without being re-checked.
        </Notice>
      )}
      {categoryChanged && (
        <Notice tone="warning" title="Category changed — not saved yet">
          Saving will delete every attribute value on this draft. You'll need to fill in the new category's attributes afterwards.
        </Notice>
      )}
      <ListingDetailsForm
        key={version.listingVersionId}
        categoryId={categoryId}
        categoryLabel={category ? category.path.join(" › ") : categoryId}
        onChangeCategory={
          can.canUpdateDraft
            ? () => {
                setPicked(categoryId);
                setPicking(true);
              }
            : undefined
        }
        defaultValues={listingFormFromVersion(version, listing.expiresAtUtc)}
        readOnly={!can.canUpdateDraft}
        submitLabel="Save draft"
        onSubmit={async (payload) => {
          await save.mutateAsync(payload);
        }}
      />

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent
          title="Change category"
          description="Brands, conditions, units and attributes depend on the category. Saving the draft with a new category deletes its attribute values."
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPicking(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!picked}
                onClick={() => {
                  setCategoryId(picked);
                  setPicking(false);
                }}
              >
                Use this category
              </Button>
            </>
          }
        >
          <CategoryPicker value={picked} onSelect={setPicked} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
