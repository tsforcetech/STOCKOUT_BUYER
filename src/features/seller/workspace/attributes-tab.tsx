import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/form-field";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { sellerListingsService } from "@/services/seller-listings.service";
import { getSellerListingActions, type EffectiveCategoryAttributeResponse, type ListingAttributesResponse, type ListingDetailResponse } from "@/api/types/seller-listings";
import { Notice } from "../components/notice";
import { isVersionConflict, sellerErrorMessage } from "../lib/errors";
import { patchListingRowVersion, sellerKeys, useListingRequirements } from "../lib/queries";
import { AttributeInput, attributeError } from "./attribute-input";

type Values = Record<string, string[]>;

function AttributesEditor({ sellerId, listing, defs, initial, readOnly }: { sellerId: string; listing: ListingDetailResponse; defs: EffectiveCategoryAttributeResponse[]; initial: ListingAttributesResponse; readOnly: boolean }) {
  const qc = useQueryClient();
  const [values, setValues] = React.useState<Values>(() => Object.fromEntries(initial.attributes.map((a) => [a.attributeDefinitionId, a.values])));
  const [showErrors, setShowErrors] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  const errors = Object.fromEntries(defs.map((d) => [d.attributeDefinitionId, attributeError(d, values[d.attributeDefinitionId] ?? [])]));
  const hasErrors = Object.values(errors).some(Boolean);
  const missingRequired = defs.filter((d) => d.isRequired && !(values[d.attributeDefinitionId] ?? []).some((v) => v.trim()));

  const save = useApiMutation({
    toastOnError: false,
    mutationFn: async () => {
      const rowVersion = qc.getQueryData<ListingDetailResponse>(sellerKeys.detail(sellerId, listing.listingId))?.rowVersion ?? listing.rowVersion;
      const attributes = defs
        .map((d) => ({ attributeDefinitionId: d.attributeDefinitionId, values: (values[d.attributeDefinitionId] ?? []).map((v) => v.trim()).filter(Boolean) }))
        .filter((a) => a.values.length > 0);
      try {
        return await sellerListingsService.replaceAttributes(sellerId, listing.listingId, { expectedRowVersion: rowVersion, attributes });
      } catch (error) {
        if (isVersionConflict(error)) await qc.invalidateQueries({ queryKey: sellerKeys.detail(sellerId, listing.listingId) });
        throw error;
      }
    },
    successMessage: "Attributes saved.",
    onSuccess: (res) => {
      qc.setQueryData(sellerKeys.attributes(sellerId, listing.listingId), res);
      patchListingRowVersion(qc, sellerId, listing.listingId, res.rowVersion);
      setDirty(false);
    },
  });

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    setFormError(null);
    if (hasErrors) return;
    save.mutate(undefined, { onError: (err) => setFormError(sellerErrorMessage(err)) });
  };

  return (
    <form onSubmit={onSave} noValidate className="space-y-5">
      <FormError message={formError} />
      {missingRequired.length > 0 && (
        <Notice tone="warning">
          {missingRequired.length} required attribute{missingRequired.length === 1 ? " is" : "s are"} empty. You can save now, but approval needs them — use <strong>Check completeness</strong> before submitting.
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {defs.map((d) => (
          <AttributeInput
            key={d.attributeDefinitionId}
            def={d}
            values={values[d.attributeDefinitionId] ?? []}
            disabled={readOnly || save.isPending}
            error={showErrors ? (errors[d.attributeDefinitionId] ?? undefined) : undefined}
            onChange={(v) => {
              setValues((prev) => ({ ...prev, [d.attributeDefinitionId]: v }));
              setDirty(true);
            }}
          />
        ))}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save attributes
          </Button>
        </div>
      )}
    </form>
  );
}

export function AttributesTab({ sellerId, listing }: { sellerId: string; listing: ListingDetailResponse }) {
  const draft = listing.currentDraftVersion;
  const can = getSellerListingActions(listing);
  const req = useListingRequirements(draft?.categoryId);
  const attrs = useQuery({
    queryKey: sellerKeys.attributes(sellerId, listing.listingId),
    queryFn: ({ signal }) => sellerListingsService.attributes(sellerId, listing.listingId, signal),
    enabled: !!draft,
  });

  if (!draft) return <Notice>Attributes can only be viewed and edited on a draft. Published listings can't be edited through the seller portal yet.</Notice>;
  if (req.isLoading || attrs.isLoading) return <PageSkeleton />;
  if (req.error) return <ErrorState error={req.error} onRetry={() => void req.refetch()} title="Couldn't load this category's attributes" />;
  if (attrs.error) return <ErrorState error={attrs.error} onRetry={() => void attrs.refetch()} title="Couldn't load the listing's attributes" />;
  const defs = [...(req.data?.attributes ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  if (!defs.length) return <EmptyState title="No attributes for this category" description="This category doesn't define any extra attributes." />;
  if (!attrs.data) return null;

  return (
    <div className="space-y-4">
      {!can.canEditAttributes && <Notice>Attributes are read-only in the listing's current state.</Notice>}
      <AttributesEditor key={`${attrs.data.listingVersionId}:${draft.categoryId}`} sellerId={sellerId} listing={listing} defs={defs} initial={attrs.data} readOnly={!can.canEditAttributes} />
    </div>
  );
}
